import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EMPCO_PRESETS,
  computePayloadDigest,
  type AssessmentResult,
  type ProductCsvAuditSummary,
} from '../../src/core/index.ts';
import { createEmpcoKitServer } from '../../server/app.mjs';

interface StartedServer {
  baseUrl: string;
  closeAll: () => Promise<void>;
}

const cleanups: Array<() => Promise<void>> = [];

async function startTempServer(
  options: {
    basePath?: string;
    maxMutationsPerMinute?: number;
    maxJsonBodyBytes?: number;
    withFakeDist?: boolean;
  } = {},
): Promise<StartedServer> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empcokit-test-'));
  const dataDir = path.join(tempDir, 'data');
  const distDir = path.join(tempDir, 'dist');
  if (options.withFakeDist) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<!doctype html><html><head><script src="/assets/main.js"></script></head><body>EMPCOKIT_SPA</body></html>',
      'utf8',
    );
  }

  const { handler, close } = createEmpcoKitServer({
    dataDir,
    distDir: options.withFakeDist ? distDir : '',
    basePath: options.basePath ?? '',
    maxMutationsPerMinute: options.maxMutationsPerMinute ?? 120,
    maxJsonBodyBytes: options.maxJsonBodyBytes ?? 5 * 1024 * 1024,
  });

  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const prefix = options.basePath ? options.basePath.replace(/\/+$/, '') : '';
  const baseUrl = `http://127.0.0.1:${port}${prefix}`;

  const closeAll = async (): Promise<void> => {
    close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  };
  cleanups.push(closeAll);
  return { baseUrl, closeAll };
}

function buildCompliantProductCsv(): string {
  return [
    'sku,product_name,marketing_copy,label_kind,legal_notice_displayed,durability_years,garan_label_displayed',
    'SKU-201,Eurokettle Pro,"EU Ecolabel (DE/038/210) stainless steel kettle tested under EN 50564",eu_ecolabel_public,true,4,true',
    'SKU-202,CottonCover Duo,"GOTS certified organic cotton shell packed in recycled pulp",third_party_certified,true,2,false',
  ].join('\n');
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop();
    if (fn) await fn();
  }
});

describe('EmpCoKit Phase 2 SQLite WAL server', () => {
  it('serves health, readyz, BASE_PATH HTML injection, presets, scan-claims, audit-csv & full assess', async () => {
    const srv = await startTempServer({ basePath: '/empcokit', withFakeDist: true });

    const rootHealthRes = await fetch(`${srv.baseUrl}/health`);
    expect(rootHealthRes.status).toBe(200);
    const rootHealth = (await rootHealthRes.json()) as Record<string, unknown>;
    expect(rootHealth.ok).toBe(true);
    expect(rootHealth.service).toBe('empcokit');
    expect(String(rootHealth.version)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(rootHealth.basePath).toBe('/empcokit');

    const apiHealthRes = await fetch(`${srv.baseUrl}/api/health`);
    expect(apiHealthRes.status).toBe(200);

    const readyzRes = await fetch(`${srv.baseUrl}/readyz`);
    expect(readyzRes.status).toBe(200);
    const readyz = (await readyzRes.json()) as Record<string, unknown>;
    expect(readyz.ok).toBe(true);
    expect(readyz.ready).toBe(true);
    expect(readyz.dbMode).toBe('WAL');

    const apiReadyzRes = await fetch(`${srv.baseUrl}/api/readyz`);
    expect(apiReadyzRes.status).toBe(200);

    const htmlRes = await fetch(`${srv.baseUrl}/`);
    expect(htmlRes.status).toBe(200);
    const html = await htmlRes.text();
    expect(html).toContain('window.__EMPCOKIT_BASE__="/empcokit"');
    expect(html).toContain('src="/empcokit/assets/main.js"');

    const presetsRes = await fetch(`${srv.baseUrl}/api/presets`);
    expect(presetsRes.status).toBe(200);
    const presetsJson = (await presetsRes.json()) as {
      presets: unknown[];
      controls: unknown[];
      rules: { effectiveDate: string; maxTurnoverFinePct: number; statutoryLegalGuaranteeYears: number };
      disclaimers: { en: string; ar: string };
      sampleCsv: string;
    };
    expect(presetsJson.presets).toHaveLength(3);
    expect(presetsJson.controls).toHaveLength(6);
    expect(presetsJson.rules.effectiveDate).toBe('2026-09-27');
    expect(presetsJson.rules.maxTurnoverFinePct).toBe(4);
    expect(presetsJson.rules.statutoryLegalGuaranteeYears).toBe(2);
    expect(presetsJson.disclaimers.en).toContain('NOT affiliated');
    expect(presetsJson.disclaimers.ar).toContain('ليست تابعة');
    expect(presetsJson.sampleCsv).toContain('NordicRunner Shoe');

    // Stateless claims scan + 2025/1960 guarantee notice check
    const scanRes = await fetch(`${srv.baseUrl}/api/scan-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketingCopy: 'Eco-Friendly & Carbon Neutral running shoe',
        hasRecognizedExcellenceProof: false,
        assessmentDate: '2026-10-20',
        channelScope: 'eu_b2c_online',
        legalGuaranteeNoticeDisplayed: false,
        commercialDurabilityYears: 4,
        coversEntireProductFreeOfCharge: true,
        garanLabelDisplayed: false,
      }),
    });
    expect(scanRes.status).toBe(200);
    const scanJson = (await scanRes.json()) as {
      claimsScan: {
        genericClaimsBlocked: number;
        carbonOffsetClaimsBlocked: number;
        hasBlockingClaims: boolean;
      };
      guarantee: {
        legalGuaranteeNoticeCompliant: boolean;
        garanLabelRequired: boolean;
        garanLabelCompliant: boolean;
      };
    };
    expect(scanJson.claimsScan.hasBlockingClaims).toBe(true);
    expect(scanJson.claimsScan.genericClaimsBlocked).toBeGreaterThanOrEqual(1);
    expect(scanJson.claimsScan.carbonOffsetClaimsBlocked).toBe(1);
    expect(scanJson.guarantee.legalGuaranteeNoticeCompliant).toBe(false);
    expect(scanJson.guarantee.garanLabelRequired).toBe(true);
    expect(scanJson.guarantee.garanLabelCompliant).toBe(false);

    // Empty CSV 400 + dangerous CSV formula escaping with UTF-8 BOM (CWE-1236)
    const emptyCsvRes = await fetch(`${srv.baseUrl}/api/audit-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: '   ' }),
    });
    expect(emptyCsvRes.status).toBe(400);

    const dangerousCsv = [
      'sku,product_name,marketing_copy,label_kind,legal_notice_displayed,durability_years,garan_label_displayed',
      'S-1,=CMD|calc,"100% Eco-Friendly & Carbon Neutral tea mug",self_certified_private,false,3,false',
      'S-2,Clean Kettle,"Standard stainless steel electric kettle",none,true,2,false',
    ].join('\n');
    const csvAuditRes = await fetch(`${srv.baseUrl}/api/audit-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: dangerousCsv, assessmentDate: '2026-10-20' }),
    });
    expect(csvAuditRes.status).toBe(200);
    const csvAuditJson = (await csvAuditRes.json()) as {
      audit: ProductCsvAuditSummary;
      exportCsv: string;
    };
    expect(csvAuditJson.audit.blockedCount).toBe(1);
    expect(csvAuditJson.audit.readyCount).toBe(1);
    expect(csvAuditJson.audit.offsetClaimHits).toBe(1);
    expect(csvAuditJson.exportCsv.startsWith('\uFEFF')).toBe(true);
    expect(csvAuditJson.exportCsv).toContain("'=CMD|calc");

    // Full stateless assessment on blocked Preset #3 (EUR 25M -> 4% = 1,000,000 EUR)
    const assessRes = await fetch(`${srv.baseUrl}/api/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: EMPCO_PRESETS[2]!.id }),
    });
    expect(assessRes.status).toBe(200);
    const assessJson = (await assessRes.json()) as {
      result: AssessmentResult;
      sha256Digest: string;
      briefMarkdownEn: string;
      briefMarkdownAr: string;
    };
    expect(assessJson.result.status).toBe('blocked');
    expect(assessJson.result.maxTurnoverFineExposureEur).toBe(1_000_000);
    expect(assessJson.sha256Digest).toMatch(/^[a-f0-9]{64}$/);
    expect(assessJson.briefMarkdownEn).toContain('NOT affiliated');
    expect(assessJson.briefMarkdownAr).toContain('ليست تابعة');
  });

  it('persists profiles, assessments & dossiers in SQLite WAL, stamps EMP-YYYY-0001, enforces 409 lock, and serves exports + views', async () => {
    const srv = await startTempServer({ basePath: '/empcokit' });

    // Organization profile CRUD
    const profRes = await fetch(`${srv.baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: 'Veloce E-Retail BV',
        productOrStoreName: 'NordicRunner EU Storefront',
        channelScope: 'eu_b2c_online',
        annualEuTurnoverEur: 25_000_000,
        notes: 'EU webshop compliance profile',
      }),
    });
    expect(profRes.status).toBe(201);
    const profList = (await (await fetch(`${srv.baseUrl}/api/profiles`)).json()) as {
      profiles: Array<{ id: string; profile: { organizationName: string } }>;
    };
    expect(profList.profiles).toHaveLength(1);
    expect(profList.profiles[0]!.profile.organizationName).toBe('Veloce E-Retail BV');

    const delProfRes = await fetch(`${srv.baseUrl}/api/profiles/${profList.profiles[0]!.id}`, {
      method: 'DELETE',
    });
    expect(delProfRes.status).toBe(200);

    // Create blocked Preset #3 via /api/assessments and list via /api/assessments
    const createRes = await fetch(`${srv.baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey: EMPCO_PRESETS[2]!.id, localeDefault: 'en' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      dossier: { id: string; slug: string; result: AssessmentResult };
      status: string;
    };
    expect(created.status).toBe('draft');
    expect(created.dossier.result.status).toBe('blocked');
    expect(created.dossier.result.maxTurnoverFineExposureEur).toBe(1_000_000);

    const listRes = await fetch(`${srv.baseUrl}/api/assessments`);
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { assessments: unknown[] };
    expect(listJson.assessments).toHaveLength(1);

    // Remediate blocked dossier into ready state via PATCH
    const patchRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketingCopy: 'EU Ecolabel (NL/019/042) recycled knit sneaker tested for 5,000 flex cycles.',
        hasRecognizedExcellenceProof: true,
        labelKind: 'eu_ecolabel_public',
        labelSchemeName: 'EU Ecolabel',
        legalGuaranteeNoticeDisplayed: true,
        commercialDurabilityYears: 3,
        coversEntireProductFreeOfCharge: true,
        garanLabelDisplayed: true,
        hasFutureCommitmentPlan: true,
        hasIndependentThirdPartyVerifier: true,
        productCatalogCsv: buildCompliantProductCsv(),
        implementedControls: [
          'EMP-CTRL-01',
          'EMP-CTRL-02',
          'EMP-CTRL-03',
          'EMP-CTRL-04',
          'EMP-CTRL-05',
          'EMP-CTRL-06',
        ],
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      dossier: { result: AssessmentResult };
    };
    expect(patched.dossier.result.status).toBe('ready');
    expect(patched.dossier.result.readinessScore).toBe(100);
    expect(patched.dossier.result.maxTurnoverFineExposureEur).toBe(0);

    // Finalize atomically to EMP-YYYY-0001
    const finalizeRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'eu-consumer-counsel' }),
    });
    expect(finalizeRes.status).toBe(200);
    const locked = (await finalizeRes.json()) as {
      status: string;
      dossier: {
        dossierCode: string;
        sha256Digest: string;
        result: AssessmentResult;
      };
    };
    const year = new Date().getUTCFullYear();
    expect(locked.status).toBe('locked');
    expect(locked.dossier.dossierCode).toBe(`EMP-${year}-0001`);
    const clientDigest = await computePayloadDigest(locked.dossier.result.canonicalDossierText);
    expect(locked.dossier.sha256Digest).toBe(clientDigest);

    // 409 immutability guards
    const lockedPatch = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commercialDurabilityYears: 1 }),
    });
    expect(lockedPatch.status).toBe(409);

    const lockedDel = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}`, {
      method: 'DELETE',
    });
    expect(lockedDel.status).toBe(409);

    const relock = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(relock.status).toBe(409);

    // Duplicate & delete editable draft
    const dupRes = await fetch(`${srv.baseUrl}/api/dossiers/${created.dossier.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(dupRes.status).toBe(201);
    const dupJson = (await dupRes.json()) as { status: string; dossier: { id: string } };
    expect(dupJson.status).toBe('draft');
    const delDup = await fetch(`${srv.baseUrl}/api/dossiers/${dupJson.dossier.id}`, {
      method: 'DELETE',
    });
    expect(delDup.status).toBe(200);

    // Exports & public share view counter
    const mdRes = await fetch(
      `${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/brief.md?locale=ar`,
    );
    expect(mdRes.status).toBe(200);
    const mdText = await mdRes.text();
    expect(mdText).toContain(locked.dossier.dossierCode);
    expect(mdText).toContain('الامتثال الأوروبي');

    const csvRes = await fetch(`${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/export.csv`);
    expect(csvRes.status).toBe(200);
    const csvBuf = Buffer.from(await csvRes.arrayBuffer());
    expect(csvBuf.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(true);
    expect(csvBuf.toString('utf8')).toContain('Eurokettle Pro');

    const sumRes = await fetch(
      `${srv.baseUrl}/api/dossiers/${locked.dossier.dossierCode}/summary?locale=en`,
    );
    expect(sumRes.status).toBe(200);
    const sumJson = (await sumRes.json()) as {
      summaryText: string;
      maxTurnoverFineExposureEur: number;
      garanLabelCompliant: boolean;
    };
    expect(sumJson.maxTurnoverFineExposureEur).toBe(0);
    expect(sumJson.garanLabelCompliant).toBe(true);
    expect(sumJson.summaryText).toContain(locked.dossier.dossierCode);
    expect(sumJson.summaryText).toContain('NOT affiliated');

    const pubRes = await fetch(`${srv.baseUrl}/api/public/reports/${locked.dossier.dossierCode}`);
    expect(pubRes.status).toBe(200);
    const pubJson = (await pubRes.json()) as {
      viewCount: number;
      markdownEn: string;
      markdownAr: string;
    };
    expect(pubJson.viewCount).toBe(1);
    expect(pubJson.markdownEn).toContain(locked.dossier.sha256Digest);
    expect(pubJson.markdownAr).toContain('EmpCoKit');
  });

  it('enforces 413 payload limits and 429 mutation throttling', async () => {
    const smallLimitSrv = await startTempServer({ maxJsonBodyBytes: 64 });
    const hugeRes = await fetch(`${smallLimitSrv.baseUrl}/api/scan-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(200) }),
    });
    expect(hugeRes.status).toBe(413);

    const rateSrv = await startTempServer({ maxMutationsPerMinute: 2 });
    const r1 = await fetch(`${rateSrv.baseUrl}/api/scan-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const r2 = await fetch(`${rateSrv.baseUrl}/api/scan-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const r3 = await fetch(`${rateSrv.baseUrl}/api/scan-claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });
});
