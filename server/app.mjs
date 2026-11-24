import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPCO_CONTROLS,
  EMPCO_EFFECTIVE_DATE,
  EMPCO_PRESETS,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  STATUTORY_LEGAL_GUARANTEE_YEARS,
  UCPD_MAX_TURNOVER_FINE_PCT,
  assessEmpcoReadiness,
  auditProductCatalogCsv,
  buildEmpcoBriefMarkdown,
  evaluateGuaranteeNotices,
  exportProductCatalogAuditCsv,
  sanitizeCsvCell,
  scanMarketingClaims,
} from '../src/core/index.ts';
import { openEmpcoDatabase, slugify } from './db.mjs';

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
let APP_VERSION = '0.2.0';
try {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(__serverDir, '../package.json'), 'utf8'),
  );
  if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
    APP_VERSION = pkgJson.version.trim();
  }
} catch {
  // fallback version
}

const VALID_SCOPES = new Set(['eu_b2c_online', 'eu_b2c_physical', 'eu_b2b_exempt']);
const VALID_LABEL_KINDS = new Set([
  'none',
  'eu_ecolabel_public',
  'third_party_certified',
  'self_certified_private',
]);
const VALID_CONTROL_IDS = new Set(EMPCO_CONTROLS.map((c) => c.id));

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function computeDigestSync(canonicalText) {
  return crypto.createHash('sha256').update(String(canonicalText || ''), 'utf8').digest('hex');
}

function makeValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function sendAttachment(res, contentType, filename, content) {
  const safeName = String(filename || 'download').replace(/[\r\n"\\/]/g, '') || 'download';
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buf.byteLength,
    'Content-Disposition': `attachment; filename="${safeName}"`,
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
  });
  res.end(buf);
}

async function readJsonBody(req, maxJsonBodyBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxJsonBodyBytes) {
      const err = new Error(`JSON payload exceeds ${maxJsonBodyBytes} byte limit`);
      err.statusCode = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('Invalid JSON payload');
    err.statusCode = 400;
    err.code = 'INVALID_JSON';
    throw err;
  }
}

function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (!trimmed || trimmed === '/') return '';
  if (!trimmed.startsWith('/')) trimmed = `/${trimmed}`;
  return trimmed.replace(/\/+$/, '');
}

function resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath = '') {
  if (normalizedAppOrigin) return normalizedAppOrigin;
  const protoHeader = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const proto = protoHeader || (req.socket?.encrypted ? 'https' : 'http');
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:4221')
    .split(',')[0]
    .trim();
  return `${proto}://${hostHeader}${normalizedBasePath}`;
}

function pickStr(srcVal, fallbackVal, maxLen = 500) {
  if (srcVal === undefined || srcVal === null) return String(fallbackVal ?? '').trim().slice(0, maxLen);
  return String(srcVal).trim().slice(0, maxLen);
}

function pickIsoDate(srcVal, fallbackVal) {
  if (srcVal === undefined || srcVal === null || srcVal === '') {
    return String(fallbackVal || '2026-10-15');
  }
  const raw = String(srcVal).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw makeValidationError(`Invalid ISO date "${raw}". Expected YYYY-MM-DD.`);
  }
  return raw;
}

function pickNonNegNumber(srcVal, fallbackVal, maxVal = 1_000_000_000_000) {
  if (srcVal === undefined || srcVal === null || srcVal === '') return fallbackVal;
  const n = Number(srcVal);
  if (!Number.isFinite(n) || n < 0) {
    throw makeValidationError(`Expected non-negative finite number, received "${srcVal}".`);
  }
  return Math.min(n, maxVal);
}

function pickBool(srcVal, fallbackVal) {
  if (typeof srcVal === 'boolean') return srcVal;
  if (srcVal === 'true' || srcVal === 1 || srcVal === '1') return true;
  if (srcVal === 'false' || srcVal === 0 || srcVal === '0') return false;
  return fallbackVal;
}

function mergeAssessmentInput(patchInput, baseInput) {
  const fb = baseInput || EMPCO_PRESETS[0].input;
  const src = patchInput && typeof patchInput === 'object' ? patchInput : {};

  const scopeRaw = pickStr(src.channelScope, fb.channelScope, 64);
  if (src.channelScope !== undefined && !VALID_SCOPES.has(scopeRaw)) {
    throw makeValidationError(
      `Unsupported channelScope "${scopeRaw}". Expected eu_b2c_online, eu_b2c_physical, or eu_b2b_exempt.`,
    );
  }

  const labelKindRaw = pickStr(src.labelKind, fb.labelKind, 64);
  if (src.labelKind !== undefined && !VALID_LABEL_KINDS.has(labelKindRaw)) {
    throw makeValidationError(
      `Unsupported labelKind "${labelKindRaw}". Expected none, eu_ecolabel_public, third_party_certified, or self_certified_private.`,
    );
  }

  let implementedControls = fb.implementedControls;
  if (Array.isArray(src.implementedControls)) {
    implementedControls = Array.from(
      new Set(src.implementedControls.filter((id) => VALID_CONTROL_IDS.has(id))),
    );
  }

  const productCatalogCsv =
    typeof src.productCatalogCsv === 'string'
      ? src.productCatalogCsv.slice(0, 1_000_000)
      : src.productCatalogCsv === null
        ? undefined
        : fb.productCatalogCsv;

  return {
    organizationName:
      pickStr(src.organizationName, fb.organizationName, 160) || fb.organizationName,
    productOrStoreName:
      pickStr(src.productOrStoreName, fb.productOrStoreName, 200) || fb.productOrStoreName,
    assessmentDate: pickIsoDate(src.assessmentDate, fb.assessmentDate),
    channelScope: VALID_SCOPES.has(scopeRaw) ? scopeRaw : fb.channelScope,
    annualEuTurnoverEur: pickNonNegNumber(src.annualEuTurnoverEur, fb.annualEuTurnoverEur),
    marketingCopy:
      typeof src.marketingCopy === 'string'
        ? src.marketingCopy.slice(0, 20_000)
        : fb.marketingCopy,
    hasRecognizedExcellenceProof: pickBool(
      src.hasRecognizedExcellenceProof,
      fb.hasRecognizedExcellenceProof,
    ),
    labelKind: VALID_LABEL_KINDS.has(labelKindRaw) ? labelKindRaw : fb.labelKind,
    labelSchemeName: pickStr(src.labelSchemeName, fb.labelSchemeName, 160),
    legalGuaranteeNoticeDisplayed: pickBool(
      src.legalGuaranteeNoticeDisplayed,
      fb.legalGuaranteeNoticeDisplayed,
    ),
    commercialDurabilityYears: pickNonNegNumber(
      src.commercialDurabilityYears,
      fb.commercialDurabilityYears,
      100,
    ),
    coversEntireProductFreeOfCharge: pickBool(
      src.coversEntireProductFreeOfCharge,
      fb.coversEntireProductFreeOfCharge,
    ),
    garanLabelDisplayed: pickBool(src.garanLabelDisplayed, fb.garanLabelDisplayed),
    hasFutureCommitmentPlan: pickBool(src.hasFutureCommitmentPlan, fb.hasFutureCommitmentPlan),
    hasIndependentThirdPartyVerifier: pickBool(
      src.hasIndependentThirdPartyVerifier,
      fb.hasIndependentThirdPartyVerifier,
    ),
    productCatalogCsv,
    implementedControls,
    notes: typeof src.notes === 'string' ? src.notes.slice(0, 4_000) : fb.notes,
  };
}

function runCoreEngineSafely(fn) {
  try {
    return fn();
  } catch (err) {
    throw makeValidationError(err instanceof Error ? err.message : String(err));
  }
}

async function runCoreAssessmentSafely(input) {
  try {
    return await assessEmpcoReadiness(input);
  } catch (err) {
    throw makeValidationError(err instanceof Error ? err.message : String(err));
  }
}

function buildDossierSummaryCsv(dossier) {
  const d = dossier;
  const r = d.result;
  const g = r.guarantee;
  const c = r.claimsScan;
  const header = [
    'dossier_code',
    'organization_name',
    'product_or_store',
    'assessment_date',
    'channel_scope',
    'status',
    'readiness_score',
    'max_turnover_fine_exposure_eur',
    'generic_claims_blocked',
    'carbon_offset_claims_blocked',
    'future_target_warnings',
    'legal_guarantee_notice_compliant',
    'commercial_durability_years',
    'garan_label_required',
    'garan_label_compliant',
  ].join(',');

  const row = [
    sanitizeCsvCell(d.dossierCode || 'DRAFT'),
    sanitizeCsvCell(r.organizationName),
    sanitizeCsvCell(r.productOrStoreName),
    sanitizeCsvCell(r.assessmentDate),
    sanitizeCsvCell(r.channelScope),
    sanitizeCsvCell(r.status),
    sanitizeCsvCell(r.readinessScore),
    sanitizeCsvCell(r.maxTurnoverFineExposureEur),
    sanitizeCsvCell(c.genericClaimsBlocked),
    sanitizeCsvCell(c.carbonOffsetClaimsBlocked),
    sanitizeCsvCell(c.futureTargetWarnings),
    sanitizeCsvCell(g.legalGuaranteeNoticeCompliant),
    sanitizeCsvCell(g.commercialDurabilityYears),
    sanitizeCsvCell(g.garanLabelRequired),
    sanitizeCsvCell(g.garanLabelCompliant),
  ].join(',');

  return `\uFEFF${header}\n${row}\n`;
}

function buildExecutiveSummaryText(dossier, locale = 'en') {
  const code = dossier.dossierCode || 'DRAFT';
  const { result } = dossier;
  const c = result.claimsScan;
  const g = result.guarantee;

  if (locale === 'ar') {
    return [
      `ملخص جاهزية EmpCoKit (Directive 2024/825 & Reg. 2025/1960) — ${code}`,
      `المؤسسة: ${result.organizationName} · المنتج: ${result.productOrStoreName} · التقييم: ${result.assessmentDate}`,
      `الجاهزية: ${result.status.toUpperCase()} (${result.readinessScore}/100) · سقف الغرامة 4%: EUR ${result.maxTurnoverFineExposureEur.toLocaleString('en-US')}`,
      `الادعاءات المحظورة: عامة=${c.genericClaimsBlocked} · كربونية=${c.carbonOffsetClaimsBlocked} · إشعار سنتين=${g.legalGuaranteeNoticeCompliant ? 'ممتثل' : 'ناقص'} · وسم GARAN=${g.garanLabelRequired ? (g.garanLabelCompliant ? 'ممتثل' : 'مفقود') : 'غير مطلوب'}`,
      `تنويه: ${result.legalDisclaimerAr}`,
    ].join('\n');
  }

  return [
    `EU EmpCo Readiness Summary (EmpCoKit — 2024/825 & 2025/1960) — ${code}`,
    `Organization: ${result.organizationName} · Product: ${result.productOrStoreName} · Assessment: ${result.assessmentDate}`,
    `Readiness: ${result.status.toUpperCase()} (${result.readinessScore}/100) · Max 4% Fine Exposure: EUR ${result.maxTurnoverFineExposureEur.toLocaleString('en-US')}`,
    `Claims & Notices: generic=${c.genericClaimsBlocked} · offset=${c.carbonOffsetClaimsBlocked} · 2yNotice=${g.legalGuaranteeNoticeCompliant} · GARAN=${g.garanLabelRequired ? (g.garanLabelCompliant ? 'compliant' : 'missing') : 'n/a'}`,
    `Notice: ${result.legalDisclaimerEn}`,
  ].join('\n');
}

function serveStaticAsset(res, pathname, resolvedDist, method = 'GET', normalizedBasePath = '') {
  if (!resolvedDist || !fs.existsSync(resolvedDist)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let decodedPath = '/';
  try {
    decodedPath = decodeURIComponent(pathname || '/');
  } catch {
    sendJson(res, 400, { error: 'Malformed path' });
    return;
  }

  const cleanRel = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(resolvedDist, cleanRel || 'index.html');
  if (candidate !== resolvedDist && !candidate.startsWith(resolvedDist + path.sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  let fileToServe = null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    fileToServe = candidate;
  } else {
    const indexFallback = path.join(resolvedDist, 'index.html');
    if (fs.existsSync(indexFallback) && fs.statSync(indexFallback).isFile()) {
      fileToServe = indexFallback;
    }
  }

  if (!fileToServe) {
    sendJson(res, 404, { error: 'Static asset not found' });
    return;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';

  if (ext === '.html') {
    let html = fs.readFileSync(fileToServe, 'utf8');
    if (normalizedBasePath) {
      html = html
        .replaceAll('href="/', `href="${normalizedBasePath}/`)
        .replaceAll('src="/', `src="${normalizedBasePath}/`);
    }
    const baseScript = `<script>window.__EMPCOKIT_BASE__=${JSON.stringify(normalizedBasePath)};</script>`;
    html = html.includes('</head>') ? html.replace('</head>', `${baseScript}</head>`) : `${baseScript}${html}`;
    const bodyBuf = Buffer.from(html, 'utf8');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': bodyBuf.byteLength,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    res.end(bodyBuf);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ...SECURITY_HEADERS,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(fileToServe).pipe(res);
}

export function createEmpcoKitServer({
  dataDir,
  distDir = '',
  appOrigin = '',
  basePath = '',
  maxMutationsPerMinute = 120,
  maxJsonBodyBytes = 5 * 1024 * 1024,
}) {
  const db = openEmpcoDatabase(dataDir);
  const resolvedDist = distDir ? path.resolve(distDir) : null;
  const normalizedAppOrigin = String(appOrigin || '').replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  const rateBuckets = new Map();

  function checkRateLimit(req, method) {
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return true;
    }
    const now = Date.now();
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
        .split(',')[0]
        .trim() || '127.0.0.1';
    const windowMs = 60_000;
    const prev = rateBuckets.get(ip) || [];
    const recent = prev.filter((ts) => now - ts < windowMs);
    if (recent.length >= maxMutationsPerMinute) {
      rateBuckets.set(ip, recent);
      return false;
    }
    recent.push(now);
    rateBuckets.set(ip, recent);
    return true;
  }

  function buildPublicReportUrl(req, slugOrCode) {
    return `${resolveBaseUrl(req, normalizedAppOrigin, normalizedBasePath)}/r/${encodeURIComponent(slugOrCode)}`;
  }

  function findStoredDossier(id) {
    return db.getDossierById(id) || db.getDossierBySlugOrCode(id);
  }

  function buildHealthPayload() {
    const stats = db.getStats();
    return {
      ok: true,
      service: 'empcokit',
      version: APP_VERSION,
      basePath: normalizedBasePath || '/',
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  function handleReadyz(res) {
    try {
      const ready = db.checkReady();
      if (!ready) {
        return sendJson(res, 503, {
          ok: false,
          ready: false,
          service: 'empcokit',
          error: 'SQLite database health check failed',
        });
      }
      return sendJson(res, 200, {
        ok: true,
        ready: true,
        service: 'empcokit',
        dbMode: 'WAL',
        version: APP_VERSION,
      });
    } catch (err) {
      return sendJson(res, 503, {
        ok: false,
        ready: false,
        service: 'empcokit',
        error: err instanceof Error ? err.message : 'SQLite database unavailable',
      });
    }
  }

  async function handleDossierCreate(req, res, body) {
    const basePreset = EMPCO_PRESETS.find((p) => p.id === body?.presetKey) || EMPCO_PRESETS[0];
    const nowIso = new Date().toISOString();
    const actor = String(body?.actor || 'empco-coordinator').trim().slice(0, 80) || 'empco-coordinator';
    const inputSource = body?.input && typeof body.input === 'object' ? body.input : body;
    const input = mergeAssessmentInput(inputSource, basePreset.input);
    const result = await runCoreAssessmentSafely(input);

    const bundle = db.createDossier(
      {
        presetKey: basePreset.id,
        slug:
          typeof body?.slug === 'string'
            ? body.slug
            : typeof body?.publicSlug === 'string'
              ? body.publicSlug
              : undefined,
        localeDefault: body?.localeDefault === 'ar' ? 'ar' : 'en',
        input,
        result,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      actor,
    );

    return sendJson(res, 201, {
      ...bundle,
      publicReportUrl: buildPublicReportUrl(req, bundle.dossier.slug),
    });
  }

  async function handleApiRequest(req, res, method, pathname, searchParams) {
    if (!checkRateLimit(req, method)) {
      return sendJson(res, 429, {
        error: 'Too many write requests; please slow down and try again shortly.',
        code: 'RATE_LIMITED',
      });
    }

    // 1. Health, Readyz & Presets
    if (method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, buildHealthPayload());
    }

    if (method === 'GET' && pathname === '/api/readyz') {
      return handleReadyz(res);
    }

    if (method === 'GET' && pathname === '/api/presets') {
      return sendJson(res, 200, {
        presets: EMPCO_PRESETS,
        controls: EMPCO_CONTROLS,
        rules: {
          effectiveDate: EMPCO_EFFECTIVE_DATE,
          maxTurnoverFinePct: UCPD_MAX_TURNOVER_FINE_PCT,
          statutoryLegalGuaranteeYears: STATUTORY_LEGAL_GUARANTEE_YEARS,
        },
        disclaimers: {
          en: LEGAL_DISCLAIMER_EN,
          ar: LEGAL_DISCLAIMER_AR,
        },
        sampleCsv: EMPCO_PRESETS[2].input.productCatalogCsv || '',
      });
    }

    // 2. Stateless Claims Scanner, Guarantee Checker, Catalog CSV Auditor & Full Assessor
    if (method === 'POST' && pathname === '/api/scan-claims') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const merged = mergeAssessmentInput(body, EMPCO_PRESETS[0].input);
      const claimsScan = runCoreEngineSafely(() =>
        scanMarketingClaims({
          marketingCopy: merged.marketingCopy,
          hasRecognizedExcellenceProof: merged.hasRecognizedExcellenceProof,
          hasFutureCommitmentPlan: merged.hasFutureCommitmentPlan,
          hasIndependentThirdPartyVerifier: merged.hasIndependentThirdPartyVerifier,
        }),
      );
      const guarantee = runCoreEngineSafely(() => evaluateGuaranteeNotices(merged));
      return sendJson(res, 200, { input: merged, claimsScan, guarantee });
    }

    if (method === 'POST' && pathname === '/api/audit-csv') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const csvText = String(body?.csv ?? body?.productCatalogCsv ?? '');
      if (!csvText.trim()) {
        return sendJson(res, 400, {
          error: 'Product catalog CSV payload is required',
          code: 'EMPTY_CSV',
        });
      }
      const assessmentDate = pickIsoDate(body?.assessmentDate, '2026-10-15');
      const audit = runCoreEngineSafely(() => auditProductCatalogCsv(csvText, assessmentDate));
      const exportCsv = exportProductCatalogAuditCsv(audit);
      return sendJson(res, 200, {
        assessmentDate,
        audit,
        exportCsv,
      });
    }

    if (method === 'POST' && pathname === '/api/assess') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const basePreset = EMPCO_PRESETS.find((p) => p.id === body?.presetKey) || EMPCO_PRESETS[0];
      const inputSource = body?.input && typeof body.input === 'object' ? body.input : body;
      const input = mergeAssessmentInput(inputSource, basePreset.input);
      const result = await runCoreAssessmentSafely(input);
      return sendJson(res, 200, {
        presetKey: basePreset.id,
        input,
        result,
        sha256Digest: result.dossierSha256,
        briefMarkdownEn: buildEmpcoBriefMarkdown(input, result, 'DRAFT', result.dossierSha256, 'en'),
        briefMarkdownAr: buildEmpcoBriefMarkdown(input, result, 'DRAFT', result.dossierSha256, 'ar'),
      });
    }

    // 3. Organization Profiles CRUD
    if (method === 'GET' && pathname === '/api/profiles') {
      return sendJson(res, 200, { profiles: db.listProfiles() });
    }

    if (method === 'POST' && pathname === '/api/profiles') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const profile = db.saveProfile(body || {});
      return sendJson(res, 201, { profile });
    }

    const profDeleteMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (method === 'DELETE' && profDeleteMatch) {
      const id = decodeURIComponent(profDeleteMatch[1] || '');
      const del = db.deleteProfile(id);
      if (!del.deleted) return sendJson(res, 404, { error: 'Profile not found' });
      return sendJson(res, 200, { deleted: true });
    }

    // 4. Stored Assessments / Dossiers List & Create
    if (method === 'GET' && pathname === '/api/assessments') {
      const dossiers = db.listDossiers();
      return sendJson(res, 200, { assessments: dossiers, dossiers });
    }

    if (method === 'POST' && pathname === '/api/assessments') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      return handleDossierCreate(req, res, body);
    }

    if (method === 'GET' && pathname === '/api/dossiers') {
      return sendJson(res, 200, { dossiers: db.listDossiers() });
    }

    if (method === 'POST' && pathname === '/api/dossiers') {
      const body = await readJsonBody(req, maxJsonBodyBytes);
      return handleDossierCreate(req, res, body);
    }

    // 5. Dossier Actions: Duplicate & Finalize / Lock
    const dupMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/duplicate$/);
    if (method === 'POST' && dupMatch) {
      const id = decodeURIComponent(dupMatch[1] || '');
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const actor = String(body?.actor || 'empco-coordinator').trim().slice(0, 80) || 'empco-coordinator';
      const cloned = db.duplicateDossier(id, actor);
      if (!cloned) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 201, {
        ...cloned,
        publicReportUrl: buildPublicReportUrl(req, cloned.dossier.slug),
      });
    }

    const finalizeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(finalize|lock)$/);
    if (method === 'POST' && finalizeMatch) {
      const id = decodeURIComponent(finalizeMatch[1] || '');
      const body = await readJsonBody(req, maxJsonBodyBytes);
      const actor = String(body?.actor || 'empco-coordinator').trim().slice(0, 80) || 'empco-coordinator';
      const lockedBundle = db.finalizeDossier(id, computeDigestSync, actor);
      if (!lockedBundle) return sendJson(res, 404, { error: 'Dossier not found' });
      return sendJson(res, 200, {
        ...lockedBundle,
        publicReportUrl: buildPublicReportUrl(
          req,
          lockedBundle.dossier.dossierCode || lockedBundle.dossier.slug,
        ),
      });
    }

    // 6. Per-Dossier Markdown Brief, Formula-Safe BOM CSV & Executive Summary
    const mdMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/(?:brief|dossier)\.md$/);
    if (method === 'GET' && mdMatch) {
      const bundle = findStoredDossier(decodeURIComponent(mdMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      const digest = d.sha256Digest || d.result.dossierSha256;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'empcokit');
      return sendAttachment(
        res,
        'text/markdown; charset=utf-8',
        `empcokit-brief-${fname}-${locale}.md`,
        buildEmpcoBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, locale),
      );
    }

    const csvMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export\.csv$/);
    if (method === 'GET' && csvMatch) {
      const bundle = findStoredDossier(decodeURIComponent(csvMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const d = bundle.dossier;
      const fname = slugify(d.dossierCode || d.slug || d.id, 'empcokit');
      const safeCsv =
        d.result.catalogAudit && d.result.catalogAudit.rows.length > 0
          ? exportProductCatalogAuditCsv(d.result.catalogAudit)
          : buildDossierSummaryCsv(d);
      return sendAttachment(res, 'text/csv; charset=utf-8', `empcokit-${fname}.csv`, safeCsv);
    }

    const summaryMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/summary$/);
    if (method === 'GET' && summaryMatch) {
      const bundle = findStoredDossier(decodeURIComponent(summaryMatch[1] || ''));
      if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
      const locale = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
      const d = bundle.dossier;
      return sendJson(res, 200, {
        locale,
        dossierCode: d.dossierCode || null,
        status: bundle.status,
        readinessStatus: d.result.status,
        readinessScore: d.result.readinessScore,
        maxTurnoverFineExposureEur: d.result.maxTurnoverFineExposureEur,
        genericClaimsBlocked: d.result.claimsScan.genericClaimsBlocked,
        carbonOffsetClaimsBlocked: d.result.claimsScan.carbonOffsetClaimsBlocked,
        garanLabelRequired: d.result.guarantee.garanLabelRequired,
        garanLabelCompliant: d.result.guarantee.garanLabelCompliant,
        summaryText: buildExecutiveSummaryText(d, locale),
      });
    }

    // 7. Single Dossier Read, Update & Delete
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (dossierMatch) {
      const id = decodeURIComponent(dossierMatch[1] || '');
      if (method === 'GET') {
        const bundle = findStoredDossier(id);
        if (!bundle) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...bundle,
          publicReportUrl: buildPublicReportUrl(
            req,
            bundle.dossier.dossierCode || bundle.dossier.slug,
          ),
        });
      }
      if (method === 'PATCH') {
        const patch = await readJsonBody(req, maxJsonBodyBytes);
        const nowIso = new Date().toISOString();

        const existing = findStoredDossier(id);
        if (!existing) return sendJson(res, 404, { error: 'Dossier not found' });
        if (existing.status === 'locked' || existing.dossier?.lockedAt) {
          return sendJson(res, 409, {
            error: 'Sealed EmpCoKit dossier is immutable against modification.',
            code: 'DOSSIER_LOCKED',
          });
        }

        const inputSource = patch?.input && typeof patch.input === 'object' ? patch.input : patch;
        const nextInput = mergeAssessmentInput(inputSource, existing.dossier.input);
        const nextResult = await runCoreAssessmentSafely(nextInput);

        const updated = db.updateDossier(
          id,
          (current) => {
            const requestedSlug =
              typeof patch?.slug === 'string' && patch.slug.trim()
                ? patch.slug.trim()
                : typeof patch?.publicSlug === 'string' && patch.publicSlug.trim()
                  ? patch.publicSlug.trim()
                  : current.slug;

            return {
              ...current,
              slug: requestedSlug,
              localeDefault:
                patch?.localeDefault === 'ar'
                  ? 'ar'
                  : patch?.localeDefault === 'en'
                    ? 'en'
                    : current.localeDefault,
              input: nextInput,
              result: nextResult,
              updatedAt: nowIso,
            };
          },
          String(patch?.actor || 'empco-coordinator').trim().slice(0, 80) || 'empco-coordinator',
        );

        if (!updated) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, {
          ...updated,
          publicReportUrl: buildPublicReportUrl(req, updated.dossier.slug),
        });
      }
      if (method === 'DELETE') {
        const del = db.deleteDossier(id);
        if (!del.deleted) return sendJson(res, 404, { error: 'Dossier not found' });
        return sendJson(res, 200, { deleted: true, id: del.id });
      }
    }

    // 8. Public Shareable Report (/api/public/reports/:slugOrCode)
    const pubMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (method === 'GET' && pubMatch) {
      const slugOrCode = decodeURIComponent(pubMatch[1] || '');
      const bundle = db.getDossierBySlugOrCode(slugOrCode, { incrementView: true });
      if (!bundle) return sendJson(res, 404, { error: 'EmpCoKit readiness dossier not found' });
      const d = bundle.dossier;
      const digest = d.sha256Digest || d.result.dossierSha256;

      return sendJson(res, 200, {
        ...bundle,
        markdownEn: buildEmpcoBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, 'en'),
        markdownAr: buildEmpcoBriefMarkdown(d.input, d.result, d.dossierCode || 'DRAFT', digest, 'ar'),
        publicReportUrl: buildPublicReportUrl(req, d.dossierCode || d.slug),
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (
        normalizedBasePath &&
        (pathname === normalizedBasePath || pathname.startsWith(`${normalizedBasePath}/`))
      ) {
        pathname = pathname.slice(normalizedBasePath.length) || '/';
      }
      const method = String(req.method || 'GET').toUpperCase();

      if (method === 'GET' && pathname === '/health') {
        sendJson(res, 200, buildHealthPayload());
        return;
      }

      if (method === 'GET' && pathname === '/readyz') {
        handleReadyz(res);
        return;
      }

      if (pathname.startsWith('/api/')) {
        await handleApiRequest(req, res, method, pathname, parsedUrl.searchParams);
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      serveStaticAsset(res, pathname, resolvedDist, method, normalizedBasePath);
    } catch (err) {
      const statusCode = err?.statusCode || 500;
      const payload = {
        error: err?.message || 'Internal server error',
        ...(err?.code ? { code: err.code } : {}),
      };
      if (!res.headersSent) {
        sendJson(res, statusCode, payload);
      } else {
        res.end();
      }
    }
  }

  return {
    handler,
    close: () => db.close(),
  };
}
