import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type {
  AssessmentInput,
  ClaimsScanResult,
  SalesChannelScope,
  SustainabilityLabelKind,
} from '../core/types.ts';
import { UI_LABELS, type UiLang } from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  claimsScan: ClaimsScanResult;
  lang: UiLang;
  locked: boolean;
  onChange: (next: AssessmentInput) => void;
}

export function ClaimsAndLabelPanel({ input, claimsScan, lang, locked, onChange }: Props) {
  const t = UI_LABELS[lang];

  return (
    <section className="emp-card rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.sectionClaims}
        </h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
        >
          {t.cutoffNote}{' '}
          <span dir="ltr" className="emp-mono">
            {t.cutoffDate}
          </span>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.orgName}
          <input
            type="text"
            dir="auto"
            className="emp-input"
            value={input.organizationName}
            disabled={locked}
            onChange={(e) => onChange({ ...input, organizationName: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.productName}
          <input
            type="text"
            dir="auto"
            className="emp-input"
            value={input.productOrStoreName}
            disabled={locked}
            onChange={(e) => onChange({ ...input, productOrStoreName: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.assessmentDate}
          <input
            type="date"
            dir="ltr"
            className="emp-input emp-mono"
            value={input.assessmentDate}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, assessmentDate: e.target.value || '2026-10-15' })
            }
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.annualTurnover}
          <input
            type="number"
            min={0}
            dir="ltr"
            className="emp-input emp-mono num-tabular"
            value={input.annualEuTurnoverEur}
            disabled={locked}
            onChange={(e) =>
              onChange({
                ...input,
                annualEuTurnoverEur: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>
          {t.channelScope}
          <select
            className="emp-input"
            value={input.channelScope}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, channelScope: e.target.value as SalesChannelScope })
            }
          >
            <option value="eu_b2c_online">{t.scopeOnline}</option>
            <option value="eu_b2c_physical">{t.scopePhysical}</option>
            <option value="eu_b2b_exempt">{t.scopeB2b}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>
          {t.marketingCopy}
          <textarea
            rows={3}
            dir="auto"
            className="emp-input"
            placeholder={t.marketingPlaceholder}
            value={input.marketingCopy}
            disabled={locked}
            onChange={(e) => onChange({ ...input, marketingCopy: e.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.labelKind}
          <select
            className="emp-input"
            value={input.labelKind}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, labelKind: e.target.value as SustainabilityLabelKind })
            }
          >
            <option value="none">{t.labelNone}</option>
            <option value="eu_ecolabel_public">{t.labelEuEcolabel}</option>
            <option value="third_party_certified">{t.labelThirdParty}</option>
            <option value="self_certified_private">{t.labelSelfCertified}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t.labelSchemeName}
          <input
            type="text"
            dir="auto"
            className="emp-input"
            value={input.labelSchemeName}
            disabled={locked}
            onChange={(e) => onChange({ ...input, labelSchemeName: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <label className="flex items-start gap-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="checkbox"
            checked={input.hasRecognizedExcellenceProof}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, hasRecognizedExcellenceProof: e.target.checked })
            }
          />
          <span style={{ color: 'var(--text-primary)' }}>{t.recognizedProof}</span>
        </label>

        <label className="flex items-start gap-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="checkbox"
            checked={input.hasFutureCommitmentPlan}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, hasFutureCommitmentPlan: e.target.checked })
            }
          />
          <span style={{ color: 'var(--text-primary)' }}>{t.futurePlan}</span>
        </label>

        <label className="flex items-start gap-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <input
            type="checkbox"
            checked={input.hasIndependentThirdPartyVerifier}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...input, hasIndependentThirdPartyVerifier: e.target.checked })
            }
          />
          <span style={{ color: 'var(--text-primary)' }}>{t.futureVerifier}</span>
        </label>
      </div>

      <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
        <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.claimsMatchesHeading}
        </div>
        {claimsScan.matches.length === 0 ? (
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--accent-emerald)' }}>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{t.noClaimMatches}</span>
          </div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {claimsScan.matches.map((m, idx) => (
              <li
                key={`${m.category}-${m.matchedTerm}-${idx}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg p-2"
                style={{
                  backgroundColor:
                    m.severity === 'blocker'
                      ? 'var(--accent-crimson-soft)'
                      : m.severity === 'warning'
                        ? 'var(--accent-amber-soft)'
                        : 'var(--accent-emerald-soft)',
                  color: 'var(--text-primary)',
                }}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span dir="ltr" className="emp-mono">
                    &ldquo;{m.matchedTerm}&rdquo;
                  </span>
                  <span className="opacity-80">({m.legalRef})</span>
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {lang === 'ar' ? m.remediationAr : m.remediationEn}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
