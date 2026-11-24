import { Copy } from 'lucide-react';
import type {
  AssessmentInput,
  ControlEvaluationItem,
  EmpcoControlId,
  GuaranteeEvaluationResult,
} from '../core/types.ts';
import { UI_LABELS, type UiLang } from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  guarantee: GuaranteeEvaluationResult;
  controls: ControlEvaluationItem[];
  lang: UiLang;
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
  onCopyNotice: (snippet: string) => void;
}

export function GuaranteeAndControlsPanel({
  input,
  guarantee,
  controls,
  lang,
  locked,
  onChange,
  onCopyNotice,
}: Props) {
  const t = UI_LABELS[lang];
  const snippet =
    lang === 'ar' ? guarantee.harmonisedNoticeSnippetAr : guarantee.harmonisedNoticeSnippetEn;

  const toggleControl = (id: EmpcoControlId) => {
    if (locked) return;
    const exists = input.implementedControls.includes(id);
    const next = exists
      ? input.implementedControls.filter((c) => c !== id)
      : [...input.implementedControls, id];
    onChange({ ...input, implementedControls: next });
  };

  return (
    <section className="emp-card rounded-2xl p-4 sm:p-5">
      <h2 className="mb-4 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
        {t.sectionGuarantee}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-2 rounded-xl border p-3 text-xs sm:col-span-2" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="checkbox"
            checked={input.legalGuaranteeNoticeDisplayed}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, legalGuaranteeNoticeDisplayed: e.target.checked })
            }
          />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t.legalNoticeToggle}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.durabilityYears}
          <input
            type="number"
            min={0}
            max={25}
            dir="ltr"
            className="emp-input emp-mono num-tabular"
            value={input.commercialDurabilityYears}
            disabled={locked}
            onChange={(e) =>
              onChange({
                ...input,
                commercialDurabilityYears: Math.max(0, Math.min(25, Number(e.target.value) || 0)),
              })
            }
          />
        </label>

        <label className="flex items-start gap-2 rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="checkbox"
            checked={input.coversEntireProductFreeOfCharge}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, coversEntireProductFreeOfCharge: e.target.checked })
            }
          />
          <span style={{ color: 'var(--text-primary)' }}>{t.freeWholeProduct}</span>
        </label>

        <label className="flex items-start gap-2 rounded-xl border p-3 text-xs sm:col-span-2" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="checkbox"
            checked={input.garanLabelDisplayed}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, garanLabelDisplayed: e.target.checked })
            }
          />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t.garanToggle}
          </span>
        </label>
      </div>

      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
            Regulation (EU) 2025/1960
          </span>
          <button
            type="button"
            onClick={() => onCopyNotice(snippet)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition"
            style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{t.copyNoticeBtn}</span>
          </button>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {snippet}
        </p>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {t.controlsHeading}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {controls.map((ctrl) => (
          <button
            key={ctrl.id}
            type="button"
            disabled={locked}
            onClick={() => toggleControl(ctrl.id)}
            className="flex flex-col gap-1 rounded-xl border p-3 text-start transition"
            style={{
              borderColor: ctrl.implemented ? 'var(--accent-emerald)' : 'var(--border-subtle)',
              backgroundColor: ctrl.implemented ? 'var(--accent-emerald-soft)' : 'var(--bg-elevated)',
            }}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span dir="ltr" className="emp-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                {ctrl.id} ({ctrl.weight}pts)
              </span>
              <span
                className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: ctrl.implemented
                    ? 'var(--accent-emerald-soft)'
                    : 'var(--accent-crimson-soft)',
                  color: ctrl.implemented ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
                }}
              >
                {ctrl.implemented ? t.implementedTag : t.missingTag}
              </span>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {lang === 'ar' ? ctrl.titleAr : ctrl.titleEn}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
