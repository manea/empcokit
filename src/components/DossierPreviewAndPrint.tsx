import {
  BookmarkPlus,
  CopyPlus,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  Lock,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import type { AssessmentResult } from '../core/types.ts';
import type { OrgProfile, StoredDossier } from '../lib/api.ts';
import { STATUS_META, UI_LABELS, type UiLang } from '../lib/i18n.ts';

interface Props {
  result: AssessmentResult;
  activeDossier: StoredDossier | null;
  savedDossiers: StoredDossier[];
  profiles: OrgProfile[];
  lang: UiLang;
  busy: boolean;
  onSaveDraft: () => void;
  onUpdateDraft: () => void;
  onFinalize: () => void;
  onDuplicate: () => void;
  onDeleteDraft: () => void;
  onSaveProfile: () => void;
  onSelectDossier: (d: StoredDossier) => void;
  onApplyProfile: (p: OrgProfile) => void;
  onDownloadBrief: () => void;
  onDownloadCsv: () => void;
  onOpenPublic: (slugOrCode: string) => void;
  onPrint: () => void;
}

export function DossierPreviewAndPrint({
  result,
  activeDossier,
  savedDossiers,
  profiles,
  lang,
  busy,
  onSaveDraft,
  onUpdateDraft,
  onFinalize,
  onDuplicate,
  onDeleteDraft,
  onSaveProfile,
  onSelectDossier,
  onApplyProfile,
  onDownloadBrief,
  onDownloadCsv,
  onOpenPublic,
  onPrint,
}: Props) {
  const t = UI_LABELS[lang];
  const isLocked = activeDossier?.status === 'locked';
  const digest = activeDossier?.sha256Digest || result.dossierSha256;
  const code = activeDossier?.dossierCode || 'DRAFT';
  const sm = STATUS_META[result.status];

  return (
    <section className="emp-card print-only-sheet rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.sectionDossier}
        </h2>
        {activeDossier && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{
              backgroundColor: isLocked ? 'var(--accent-emerald-soft)' : 'var(--accent-amber-soft)',
              color: isLocked ? 'var(--accent-emerald)' : 'var(--accent-amber)',
            }}
          >
            {isLocked && <Lock className="h-3 w-3" />}
            <span dir="ltr" className="emp-mono">
              {code}
            </span>
            <span>· {isLocked ? t.lockedStatus : t.draftStatus}</span>
          </span>
        )}
      </div>

      {/* Action toolbar */}
      <div className="no-print mb-5 flex flex-wrap gap-2">
        {!activeDossier && (
          <button
            type="button"
            disabled={busy}
            onClick={onSaveDraft}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{t.saveDraftBtn}</span>
          </button>
        )}

        {activeDossier && !isLocked && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onUpdateDraft}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t.updateDraftBtn}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onFinalize}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-emerald)', color: '#FFFFFF' }}
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{t.finalizeBtn}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onDeleteDraft}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t.deleteBtn}</span>
            </button>
          </>
        )}

        {activeDossier && isLocked && (
          <button
            type="button"
            disabled={busy}
            onClick={onDuplicate}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
          >
            <CopyPlus className="h-3.5 w-3.5" />
            <span>{t.duplicateBtn}</span>
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onSaveProfile}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <span>{t.saveProfileBtn}</span>
        </button>

        <button
          type="button"
          onClick={onDownloadBrief}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
        >
          <FileDown className="h-3.5 w-3.5" />
          <span>{t.downloadMdBtn}</span>
        </button>

        <button
          type="button"
          onClick={onDownloadCsv}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>{t.downloadDossierCsvBtn}</span>
        </button>

        {activeDossier && (
          <button
            type="button"
            onClick={() => onOpenPublic(activeDossier.dossierCode || activeDossier.slug)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>
              {t.openPublicBtn}
              <span dir="ltr" className="emp-mono">
                {activeDossier.dossierCode || activeDossier.slug}
              </span>
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
        >
          <Printer className="h-3.5 w-3.5" />
          <span>{t.printBtn}</span>
        </button>
      </div>

      {/* Findings list */}
      <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {t.findingsHeading}
      </h3>
      <ul className="space-y-2 text-xs">
        {result.findings.map((f, idx) => (
          <li
            key={`${f.code}-${idx}`}
            className="rounded-xl border p-3"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor:
                f.severity === 'blocker'
                  ? 'var(--accent-crimson-soft)'
                  : f.severity === 'warning'
                    ? 'var(--accent-amber-soft)'
                    : 'var(--bg-elevated)',
            }}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {lang === 'ar' ? f.titleAr : f.titleEn}
              </span>
              <span dir="ltr" className="emp-mono text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {f.code} · {f.legalRef}
              </span>
            </div>
            <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {lang === 'ar' ? f.detailAr : f.detailEn}
            </p>
          </li>
        ))}
      </ul>

      {/* Print-friendly A4 executive summary + SHA-256 stamp */}
      <div className="mt-5 rounded-xl border p-3.5 text-xs" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-bold">
          <span>
            {t.printSummaryTitle} ·{' '}
            <span dir="ltr" className="emp-mono">
              {code}
            </span>
          </span>
          <span style={{ color: sm.badgeColor }}>
            {lang === 'ar' ? sm.ar : sm.en} (<span dir="ltr">{result.readinessScore}/100</span>)
          </span>
        </div>
        <div className="mb-1.5 break-all text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {t.digestLabel}:{' '}
          <span dir="ltr" className="emp-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            {digest}
          </span>
        </div>
        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {lang === 'ar' ? result.legalDisclaimerAr : result.legalDisclaimerEn}
        </div>
      </div>

      {/* Saved profiles & dossiers */}
      <div className="no-print mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t.savedProfilesHeading} ({profiles.length})
          </h4>
          {profiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onApplyProfile(p)}
                  className="rounded-lg border px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t.savedDossiersHeading} ({savedDossiers.length})
          </h4>
          {savedDossiers.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t.noSavedDossiers}
            </p>
          ) : (
            <div className="space-y-1.5">
              {savedDossiers.slice(0, 6).map((d) => {
                const isSelected = activeDossier?.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDossier(d)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-xs"
                    style={{
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--bg-soft)' : 'var(--bg-elevated)',
                    }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {d.input.organizationName}
                    </span>
                    <span dir="ltr" className="emp-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {d.dossierCode || d.slug} · {d.result.status.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
