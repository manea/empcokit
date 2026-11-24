import type { AssessmentResult } from '../core/types.ts';
import { STATUS_META, UI_LABELS, type UiLang } from '../lib/i18n.ts';

interface Props {
  result: AssessmentResult;
  lang: UiLang;
}

export function EmpcoNoticeAndRiskSvg({ result, lang }: Props) {
  const t = UI_LABELS[lang];
  const g = result.guarantee;
  const meta = STATUS_META[result.status];

  const legalStateLabel = !g.legalGuaranteeNoticeRequired
    ? 'EXEMPT (B2B)'
    : g.legalGuaranteeNoticeCompliant
      ? 'DISPLAYED (2Y LEGAL)'
      : 'MISSING BLOCKER';
  const legalAccent = !g.legalGuaranteeNoticeRequired
    ? 'var(--text-secondary)'
    : g.legalGuaranteeNoticeCompliant
      ? 'var(--accent-emerald)'
      : 'var(--accent-crimson)';

  const garanStateLabel = !g.garanLabelRequired
    ? `N/A (${g.commercialDurabilityYears}Y <= 2Y)`
    : g.garanLabelCompliant
      ? `GARAN ${g.commercialDurabilityYears}Y DISPLAYED`
      : `GARAN ${g.commercialDurabilityYears}Y MISSING`;
  const garanAccent = !g.garanLabelRequired
    ? 'var(--text-secondary)'
    : g.garanLabelCompliant
      ? 'var(--accent-emerald)'
      : 'var(--accent-crimson)';

  const scoreWidth = Math.max(8, Math.round((result.readinessScore / 100) * 300));

  return (
    <section className="emp-card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {t.sectionSvg}
        </h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}
        >
          {lang === 'ar' ? meta.ar : meta.en} · <span dir="ltr">{result.readinessScore}/100</span>
        </span>
      </div>

      <div dir="ltr" className="overflow-hidden rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
        <svg viewBox="0 0 760 220" className="h-auto w-full" role="img" aria-label="Regulation (EU) 2025/1960 Legal Guarantee Notice and GARAN Label Preview">
          {/* Card 1: Harmonised 2-Year Legal Guarantee Notice */}
          <rect x="8" y="10" width="362" height="118" rx="10" fill="var(--bg-surface)" stroke={legalAccent} strokeWidth="2" />
          <rect x="20" y="22" width="38" height="38" rx="8" fill="#0F4C81" />
          <circle cx="39" cy="41" r="11" stroke="#FBBF24" strokeWidth="2.2" fill="none" strokeDasharray="3 3" />
          <text x="39" y="45" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700">EU</text>
          <text x="68" y="36" fill="var(--text-primary)" fontSize="13" fontWeight="700">Legal Guarantee Notice (2025/1960)</text>
          <text x="68" y="53" fill="var(--text-secondary)" fontSize="10.5">Min. 2-year free conformity remedy</text>
          <rect x="20" y="72" width="338" height="42" rx="6" fill="var(--bg-elevated)" />
          <text x="30" y="90" fill={legalAccent} fontSize="11.5" fontWeight="700">{legalStateLabel}</text>
          <text x="30" y="106" fill="var(--text-secondary)" fontSize="10">Effective cutoff: 2026-09-27 · Pre-contract B2C display</text>

          {/* Card 2: Conditional GARAN Durability Label */}
          <rect x="390" y="10" width="362" height="118" rx="10" fill="var(--bg-surface)" stroke={garanAccent} strokeWidth="2" />
          <rect x="402" y="22" width="76" height="38" rx="6" fill="#146B48" />
          <text x="440" y="40" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="800">GARAN</text>
          <text x="440" y="53" textAnchor="middle" fill="#D1FAE5" fontSize="9" fontWeight="700">
            {g.commercialDurabilityYears}Y FREE
          </text>
          <text x="488" y="36" fill="var(--text-primary)" fontSize="13" fontWeight="700">Commercial Durability Label (&gt;2y)</text>
          <text x="488" y="53" fill="var(--text-secondary)" fontSize="10.5">Mandatory if free warranty &gt; 2 years</text>
          <rect x="402" y="72" width="338" height="42" rx="6" fill="var(--bg-elevated)" />
          <text x="412" y="90" fill={garanAccent} fontSize="11.5" fontWeight="700">{garanStateLabel}</text>
          <text x="412" y="106" fill="var(--text-secondary)" fontSize="10">
            {g.garanLabelRequired ? 'Whole-product >2y guarantee active' : 'Optional/exempt (&lt;=2y or non-free)'}
          </text>

          {/* Bottom Bar: Score Progress & UCPD 4% Max Turnover Exposure */}
          <rect x="8" y="140" width="744" height="70" rx="10" fill="var(--bg-surface)" stroke="var(--border-subtle)" strokeWidth="1.5" />
          <text x="22" y="164" fill="var(--text-primary)" fontSize="12" fontWeight="700">
            EmpCo Readiness Score: {result.readinessScore}/100
          </text>
          <rect x="22" y="176" width="300" height="16" rx="8" fill="var(--bg-elevated)" />
          <rect x="22" y="176" width={scoreWidth} height="16" rx="8" fill={meta.barColor} />
          <text x="342" y="164" fill="var(--text-primary)" fontSize="12" fontWeight="700">
            4% Max UCPD Turnover Fine Cap Exposure
          </text>
          <text
            x="342"
            y="189"
            fill={result.maxTurnoverFineExposureEur > 0 ? 'var(--accent-crimson)' : 'var(--accent-emerald)'}
            fontSize="16"
            fontWeight="800"
          >
            EUR {result.maxTurnoverFineExposureEur.toLocaleString('en-US')}
          </text>
          <text x="580" y="189" fill="var(--text-secondary)" fontSize="11">
            Blocked Claims: {result.claimsScan.genericClaimsBlocked + result.claimsScan.carbonOffsetClaimsBlocked}
          </text>
        </svg>
      </div>
    </section>
  );
}
