import {
  EMPCO_PRESETS,
  assessEmpcoReadiness,
  buildEmpcoBriefMarkdown,
  computePayloadDigest,
  exportProductCatalogAuditCsv,
  sanitizeCsvCell,
} from '../core/index.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { withBase } from './basePath.ts';

export type ApiMode = 'server' | 'local';

export interface StoredDossier {
  id: string;
  presetKey: string;
  slug: string;
  dossierCode: string;
  status: 'draft' | 'locked';
  localeDefault: 'en' | 'ar';
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  sha256Digest: string | null;
  viewCount: number;
  input: AssessmentInput;
  result: AssessmentResult;
}

export interface DossierBundle {
  dossier: StoredDossier;
  status: 'draft' | 'locked';
  slug: string;
  viewCount: number;
  publicReportUrl?: string;
}

export interface OrgProfile {
  id: string;
  name: string;
  profile: {
    organizationName: string;
    productOrStoreName: string;
    channelScope: AssessmentInput['channelScope'];
    annualEuTurnoverEur: number;
    notes: string;
  };
  createdAt: string;
  updatedAt: string;
}

const LS_DOSSIERS = 'empcokit.v1.dossiers';
const LS_PROFILES = 'empcokit.v1.profiles';
const LS_SEQ = 'empcokit.v1.seq';

function slugifyClient(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '') || 'empco-entity'
  );
}

function readLocalList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function triggerTextDownload(
  filename: string,
  mimeType: string,
  content: string | Uint8Array<ArrayBuffer>,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function detectApiMode(): Promise<ApiMode> {
  try {
    const res = await fetch(withBase('/api/health'), { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; service?: string };
      if (data?.ok && data?.service === 'empcokit') return 'server';
    }
  } catch {
    // static Cloudflare Workers / offline browser mode
  }
  return 'local';
}

export async function listDossiers(mode: ApiMode): Promise<StoredDossier[]> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/dossiers'), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load EmpCoKit dossiers');
    const json = (await res.json()) as { dossiers: Array<{ dossier: StoredDossier }> };
    return json.dossiers.map((item) => item.dossier);
  }
  return readLocalList<StoredDossier>(LS_DOSSIERS);
}

export async function listProfiles(mode: ApiMode): Promise<OrgProfile[]> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/profiles'), { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { profiles: OrgProfile[] };
    return json.profiles || [];
  }
  return readLocalList<OrgProfile>(LS_PROFILES);
}

export async function saveOrgProfile(mode: ApiMode, input: AssessmentInput): Promise<OrgProfile> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/profiles'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName: input.organizationName,
        productOrStoreName: input.productOrStoreName,
        channelScope: input.channelScope,
        annualEuTurnoverEur: input.annualEuTurnoverEur,
        notes: input.notes || '',
      }),
    });
    const json = (await res.json()) as { profile: OrgProfile };
    return json.profile;
  }

  const now = new Date().toISOString();
  const profile: OrgProfile = {
    id: `prof-local-${Date.now().toString(36)}`,
    name: input.organizationName,
    profile: {
      organizationName: input.organizationName,
      productOrStoreName: input.productOrStoreName,
      channelScope: input.channelScope,
      annualEuTurnoverEur: input.annualEuTurnoverEur,
      notes: input.notes || '',
    },
    createdAt: now,
    updatedAt: now,
  };
  writeLocalList(LS_PROFILES, [profile, ...readLocalList<OrgProfile>(LS_PROFILES)]);
  return profile;
}

export async function createDossierFromInput(
  mode: ApiMode,
  input: AssessmentInput,
  localeDefault: 'en' | 'ar',
  presetKey: string = EMPCO_PRESETS[0]!.id,
): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase('/api/dossiers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey, input, localeDefault }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to save draft dossier');
    }
    return (await res.json()) as DossierBundle;
  }

  const result = await assessEmpcoReadiness(input);
  const now = new Date().toISOString();
  const id = `emp-local-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const baseSlug = slugifyClient(input.organizationName);
  let slug = baseSlug;
  let seq = 2;
  while (list.some((d) => d.slug === slug)) {
    slug = `${baseSlug}-${seq}`;
    seq += 1;
  }
  const dossier: StoredDossier = {
    id,
    presetKey,
    slug,
    dossierCode: '',
    status: 'draft',
    localeDefault,
    createdAt: now,
    updatedAt: now,
    lockedAt: null,
    sha256Digest: null,
    viewCount: 0,
    input,
    result,
  };
  writeLocalList(LS_DOSSIERS, [dossier, ...list]);
  return {
    dossier,
    status: dossier.status,
    slug: dossier.slug,
    viewCount: 0,
    publicReportUrl: withBase(`/r/${dossier.slug}`),
  };
}

export async function updateDossierInput(
  mode: ApiMode,
  dossierId: string,
  input: AssessmentInput,
  localeDefault: 'en' | 'ar',
): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(dossierId)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, localeDefault }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to update draft dossier');
    }
    return (await res.json()) as DossierBundle;
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const target = list.find((d) => d.id === dossierId);
  if (!target) throw new Error('Draft dossier not found');
  if (target.status === 'locked') throw new Error('Sealed dossier is immutable');
  const result = await assessEmpcoReadiness(input);
  const updated: StoredDossier = {
    ...target,
    localeDefault,
    updatedAt: new Date().toISOString(),
    input,
    result,
  };
  writeLocalList(
    LS_DOSSIERS,
    list.map((d) => (d.id === dossierId ? updated : d)),
  );
  return {
    dossier: updated,
    status: updated.status,
    slug: updated.slug,
    viewCount: updated.viewCount,
    publicReportUrl: withBase(`/r/${updated.slug}`),
  };
}

export async function deleteDraftDossier(mode: ApiMode, dossierId: string): Promise<void> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(dossierId)}`), {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to delete draft dossier');
    }
    return;
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const target = list.find((d) => d.id === dossierId);
  if (target?.status === 'locked') throw new Error('Sealed dossier cannot be deleted');
  writeLocalList(
    LS_DOSSIERS,
    list.filter((d) => d.id !== dossierId),
  );
}

export async function duplicateDossier(mode: ApiMode, dossierId: string): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(dossierId)}/duplicate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to duplicate dossier');
    }
    return (await res.json()) as DossierBundle;
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const src = list.find((d) => d.id === dossierId);
  if (!src) throw new Error('Source dossier not found');
  const now = new Date().toISOString();
  const suffix = Math.random().toString(16).slice(2, 6);
  const cloned: StoredDossier = {
    ...src,
    id: `emp-local-${Date.now().toString(36)}-${suffix}`,
    slug: `${slugifyClient(src.slug)}-copy-${suffix}`,
    dossierCode: '',
    status: 'draft',
    lockedAt: null,
    sha256Digest: null,
    viewCount: 0,
    input: {
      ...src.input,
      organizationName: `${src.input.organizationName} (Copy)`,
    },
    createdAt: now,
    updatedAt: now,
  };
  writeLocalList(LS_DOSSIERS, [cloned, ...list]);
  return {
    dossier: cloned,
    status: cloned.status,
    slug: cloned.slug,
    viewCount: 0,
    publicReportUrl: withBase(`/r/${cloned.slug}`),
  };
}

export async function finalizeDossier(mode: ApiMode, dossierId: string): Promise<DossierBundle> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(dossierId)}/finalize`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to finalize dossier');
    }
    return (await res.json()) as DossierBundle;
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const target = list.find((d) => d.id === dossierId);
  if (!target) throw new Error('Dossier not found');
  if (target.status === 'locked') throw new Error('Dossier already finalized');

  const seq = Number(localStorage.getItem(LS_SEQ) || '0') + 1;
  localStorage.setItem(LS_SEQ, String(seq));
  const year = new Date().getUTCFullYear();
  const code = `EMP-${year}-${String(seq).padStart(4, '0')}`;
  const digest = await computePayloadDigest(target.result.canonicalDossierText);
  const now = new Date().toISOString();

  const locked: StoredDossier = {
    ...target,
    dossierCode: code,
    status: 'locked',
    sha256Digest: digest,
    lockedAt: now,
    updatedAt: now,
  };
  writeLocalList(
    LS_DOSSIERS,
    list.map((d) => (d.id === dossierId ? locked : d)),
  );
  return {
    dossier: locked,
    status: 'locked',
    slug: locked.slug,
    viewCount: locked.viewCount,
    publicReportUrl: withBase(`/r/${code}`),
  };
}

export async function loadPublicReport(
  mode: ApiMode,
  slugOrCode: string,
): Promise<(DossierBundle & { markdownEn: string; markdownAr: string }) | null> {
  if (mode === 'server') {
    const res = await fetch(withBase(`/api/public/reports/${encodeURIComponent(slugOrCode)}`), {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DossierBundle & { markdownEn: string; markdownAr: string };
  }

  const list = readLocalList<StoredDossier>(LS_DOSSIERS);
  const found = list.find(
    (d) => d.id === slugOrCode || d.slug === slugOrCode || d.dossierCode === slugOrCode,
  );
  if (!found) return null;
  const updated: StoredDossier = { ...found, viewCount: found.viewCount + 1 };
  writeLocalList(
    LS_DOSSIERS,
    list.map((d) => (d.id === found.id ? updated : d)),
  );
  const code = updated.dossierCode || 'DRAFT';
  const digest = updated.sha256Digest || updated.result.dossierSha256;
  return {
    dossier: updated,
    status: updated.status,
    slug: updated.slug,
    viewCount: updated.viewCount,
    publicReportUrl: withBase(`/r/${updated.dossierCode || updated.slug}`),
    markdownEn: buildEmpcoBriefMarkdown(updated.input, updated.result, code, digest, 'en'),
    markdownAr: buildEmpcoBriefMarkdown(updated.input, updated.result, code, digest, 'ar'),
  };
}

export async function downloadBriefMarkdown(
  mode: ApiMode,
  input: AssessmentInput,
  result: AssessmentResult,
  dossier: StoredDossier | null,
  locale: 'en' | 'ar',
): Promise<void> {
  const code = dossier?.dossierCode || 'DRAFT';
  if (mode === 'server' && dossier) {
    const key = dossier.dossierCode || dossier.id;
    const res = await fetch(
      withBase(`/api/dossiers/${encodeURIComponent(key)}/brief.md?locale=${locale}`),
    );
    if (res.ok) {
      const md = await res.text();
      triggerTextDownload(
        `empcokit-brief-${slugifyClient(code || dossier.slug)}-${locale}.md`,
        'text/markdown; charset=utf-8',
        md,
      );
      return;
    }
  }

  const digest = dossier?.sha256Digest || result.dossierSha256;
  const md = buildEmpcoBriefMarkdown(input, result, code, digest, locale);
  triggerTextDownload(
    `empcokit-brief-${slugifyClient(code || input.organizationName)}-${locale}.md`,
    'text/markdown; charset=utf-8',
    md,
  );
}

export async function downloadSafeBomCsv(
  mode: ApiMode,
  result: AssessmentResult,
  dossier: StoredDossier | null,
): Promise<void> {
  const code = dossier?.dossierCode || 'DRAFT';
  if (mode === 'server' && dossier) {
    const key = dossier.dossierCode || dossier.id;
    const res = await fetch(withBase(`/api/dossiers/${encodeURIComponent(key)}/export.csv`));
    if (res.ok) {
      const rawBytes = new Uint8Array(await res.arrayBuffer());
      const hasBom =
        rawBytes.length >= 3 &&
        rawBytes[0] === 0xef &&
        rawBytes[1] === 0xbb &&
        rawBytes[2] === 0xbf;
      let bytesToDownload: Uint8Array<ArrayBuffer>;
      if (hasBom) {
        bytesToDownload = rawBytes;
      } else {
        bytesToDownload = new Uint8Array(3 + rawBytes.length);
        bytesToDownload.set([0xef, 0xbb, 0xbf], 0);
        bytesToDownload.set(rawBytes, 3);
      }
      triggerTextDownload(
        `empcokit-${slugifyClient(code || dossier.slug)}.csv`,
        'text/csv; charset=utf-8',
        bytesToDownload,
      );
      return;
    }
  }

  if (result.catalogAudit && result.catalogAudit.rows.length > 0) {
    const csvText = exportProductCatalogAuditCsv(result.catalogAudit);
    triggerTextDownload(
      `empcokit-${slugifyClient(code || result.organizationName)}.csv`,
      'text/csv; charset=utf-8',
      csvText,
    );
    return;
  }

  const g = result.guarantee;
  const c = result.claimsScan;
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
    sanitizeCsvCell(code),
    sanitizeCsvCell(result.organizationName),
    sanitizeCsvCell(result.productOrStoreName),
    sanitizeCsvCell(result.assessmentDate),
    sanitizeCsvCell(result.channelScope),
    sanitizeCsvCell(result.status),
    sanitizeCsvCell(result.readinessScore),
    sanitizeCsvCell(result.maxTurnoverFineExposureEur),
    sanitizeCsvCell(c.genericClaimsBlocked),
    sanitizeCsvCell(c.carbonOffsetClaimsBlocked),
    sanitizeCsvCell(c.futureTargetWarnings),
    sanitizeCsvCell(g.legalGuaranteeNoticeCompliant),
    sanitizeCsvCell(g.commercialDurabilityYears),
    sanitizeCsvCell(g.garanLabelRequired),
    sanitizeCsvCell(g.garanLabelCompliant),
  ].join(',');

  triggerTextDownload(
    `empcokit-${slugifyClient(code || result.organizationName)}.csv`,
    'text/csv; charset=utf-8',
    `\uFEFF${header}\n${row}\n`,
  );
}
