import { Download, Trash2, Upload } from 'lucide-react';
import { EMPCO_PRESETS } from '../core/index.ts';
import type { ProductCsvAuditSummary } from '../core/types.ts';
import { STATUS_META, UI_LABELS, type UiLang } from '../lib/i18n.ts';

interface Props {
  csvText: string;
  catalogAudit: ProductCsvAuditSummary | null;
  lang: UiLang;
  locked: boolean;
  onCsvChange: (nextCsv: string) => void;
  onExportCsv: () => void;
}

export function ProductCatalogCsvPanel({
  csvText,
  catalogAudit,
  lang,
  locked,
  onCsvChange,
  onExportCsv,
}: Props) {
  const t = UI_LABELS[lang];
  const sampleCsv = EMPCO_PRESETS[2]?.input.productCatalogCsv || '';

  return (
    <section className="emp-card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.sectionCsv}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t.uploadCsv}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={locked}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') onCsvChange(reader.result);
                };
                reader.readAsText(file);
              }}
            />
          </label>

          <button
            type="button"
            disabled={locked}
            onClick={() => onCsvChange(sampleCsv)}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
          >
            {t.loadSampleCsv}
          </button>

          <button
            type="button"
            disabled={locked || !csvText.trim()}
            onClick={() => onCsvChange('')}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.clearCsv}</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.exportCsvBtn}</span>
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        dir="ltr"
        className="emp-input emp-mono text-xs"
        placeholder={t.csvPlaceholder}
        value={csvText}
        disabled={locked}
        onChange={(e) => onCsvChange(e.target.value)}
      />

      {!catalogAudit ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t.csvEmpty}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div style={{ color: 'var(--text-secondary)' }}>{t.csvKpiTotal}</div>
              <div dir="ltr" className="emp-mono num-tabular text-base font-bold">
                {catalogAudit.totalSkus}
              </div>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--accent-emerald-soft)' }}>
              <div style={{ color: 'var(--accent-emerald)' }}>{t.csvKpiReady}</div>
              <div dir="ltr" className="emp-mono num-tabular text-base font-bold" style={{ color: 'var(--accent-emerald)' }}>
                {catalogAudit.readyCount}
              </div>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--accent-amber-soft)' }}>
              <div style={{ color: 'var(--accent-amber)' }}>{t.csvKpiConditional}</div>
              <div dir="ltr" className="emp-mono num-tabular text-base font-bold" style={{ color: 'var(--accent-amber)' }}>
                {catalogAudit.conditionalCount}
              </div>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: 'var(--accent-crimson-soft)' }}>
              <div style={{ color: 'var(--accent-crimson)' }}>{t.csvKpiBlocked}</div>
              <div dir="ltr" className="emp-mono num-tabular text-base font-bold" style={{ color: 'var(--accent-crimson)' }}>
                {catalogAudit.blockedCount}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <span>
              {t.csvKpiGeneric}: <strong dir="ltr">{catalogAudit.genericClaimHits}</strong>
            </span>
            <span>·</span>
            <span>
              {t.csvKpiOffset}: <strong dir="ltr">{catalogAudit.offsetClaimHits}</strong>
            </span>
            <span>·</span>
            <span>
              {t.csvKpiPrivate}: <strong dir="ltr">{catalogAudit.selfLabelHits}</strong>
            </span>
            <span>·</span>
            <span>
              {t.csvKpiNotice}: <strong dir="ltr">{catalogAudit.missingNoticeHits}</strong>
            </span>
          </div>

          {catalogAudit.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
              <table className="w-full border-collapse text-start text-xs">
                <thead style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  <tr>
                    <th className="p-2 text-start">{t.colSku}</th>
                    <th className="p-2 text-start">{t.colProduct}</th>
                    <th className="p-2 text-start">{t.colLabel}</th>
                    <th className="p-2 text-start">{t.colNotice}</th>
                    <th className="p-2 text-start">{t.colDurability}</th>
                    <th className="p-2 text-start">{t.colStatus}</th>
                    <th className="p-2 text-start">{t.colIssues}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogAudit.rows.map((r) => {
                    const sm = STATUS_META[r.status];
                    return (
                      <tr key={r.rowNumber} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td dir="ltr" className="emp-mono p-2 font-semibold">{r.sku}</td>
                        <td className="p-2 font-medium">{r.productName}</td>
                        <td dir="ltr" className="emp-mono p-2 text-[11px]">{r.labelKind}</td>
                        <td className="p-2">{r.legalNoticeDisplayed ? t.yes : t.no}</td>
                        <td dir="ltr" className="emp-mono p-2 text-[11px]">
                          {r.durabilityGuaranteeYears}y / {r.garanLabelDisplayed ? 'GARAN' : '-'}
                        </td>
                        <td className="p-2">
                          <span
                            className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ backgroundColor: sm.badgeBg, color: sm.badgeColor }}
                          >
                            {lang === 'ar' ? sm.ar : sm.en}
                          </span>
                        </td>
                        <td className="p-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          {r.issues.length > 0 ? r.issues.join(' | ') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
