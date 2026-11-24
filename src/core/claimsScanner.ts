import {
  CARBON_OFFSET_CLAIM_PATTERNS,
  FUTURE_COMMITMENT_PATTERNS,
  GENERIC_ECO_CLAIM_PATTERNS,
} from './empcoCatalog.ts';
import type { ClaimMatch, ClaimsScanResult } from './types.ts';

function collectMatches(text: string, patterns: readonly RegExp[]): string[] {
  const seen = new Set<string>();
  const hits: string[] = [];
  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let m = re.exec(text);
    while (m !== null) {
      const token = m[0]!.trim();
      const key = token.toLowerCase();
      if (token && !seen.has(key)) {
        seen.add(key);
        hits.push(token);
      }
      m = re.exec(text);
    }
  }
  return hits;
}

export function scanMarketingClaims(params: {
  marketingCopy: string;
  hasRecognizedExcellenceProof: boolean;
  hasFutureCommitmentPlan: boolean;
  hasIndependentThirdPartyVerifier: boolean;
}): ClaimsScanResult {
  const copy = String(params.marketingCopy ?? '');
  const matches: ClaimMatch[] = [];

  const offsetHits = collectMatches(copy, CARBON_OFFSET_CLAIM_PATTERNS);
  for (const term of offsetHits) {
    matches.push({
      category: 'carbon_offset',
      matchedTerm: term,
      legalRef: 'Directive (EU) 2024/825 (UCPD Annex I, point 4c)',
      severity: 'blocker',
      remediationEn: `Remove offset-based product claim "${term}"; report verified lifecycle emissions reduction separately instead.`,
      remediationAr: `إزالة عبارة الحياد الكربوني المبنية على التعويضات "${term}" واستبدالها ببيان خفض الانبعاثات الفعلي لسلسلة القيمة.`,
    });
  }

  const genericHits = collectMatches(copy, GENERIC_ECO_CLAIM_PATTERNS);
  for (const term of genericHits) {
    if (params.hasRecognizedExcellenceProof) {
      matches.push({
        category: 'generic_eco',
        matchedTerm: term,
        legalRef: 'Directive (EU) 2024/825 (UCPD Annex I, point 4a)',
        severity: 'info',
        remediationEn: `Generic claim "${term}" is paired with recognized official excellence proof; keep certificate accessible to buyers.`,
        remediationAr: `الادعاء العام "${term}" مدعوم بإثبات تفوق بيئي معترف به رسمياً؛ احتفظ برقم الشهادة متاحاً للمستهلك.`,
      });
    } else {
      matches.push({
        category: 'generic_eco',
        matchedTerm: term,
        legalRef: 'Directive (EU) 2024/825 (UCPD Annex I, point 4a)',
        severity: 'blocker',
        remediationEn: `Banned unproven generic claim "${term}": replace with specific verifiable metric or substantiate with EU Ecolabel / ISO 14024 excellence.`,
        remediationAr: `ادعاء عام محظور بدون إثبات رسمي "${term}": استبدله بمقياس كمي محدد أو شهادة EU Ecolabel.`,
      });
    }
  }

  const futureHits = collectMatches(copy, FUTURE_COMMITMENT_PATTERNS);
  for (const term of futureHits) {
    const verified =
      params.hasFutureCommitmentPlan && params.hasIndependentThirdPartyVerifier;
    matches.push({
      category: 'unverified_future_target',
      matchedTerm: term,
      legalRef: 'Directive (EU) 2024/825 (UCPD Art. 6(2)(d))',
      severity: verified ? 'info' : 'blocker',
      remediationEn: verified
        ? `Future target "${term}" backed by public implementation plan and third-party verifier.`
        : `Future target "${term}" lacks both a detailed public implementation plan and regular independent third-party verification.`,
      remediationAr: verified
        ? `الهدف المستقبلي "${term}" موثق بخطة علنية وتدقيق طرف ثالث مستقل.`
        : `الهدف المستقبلي "${term}" يفتقر لخطة تنفيذية تفصيلية وتدقيق دوري من خبير مستقل.`,
    });
  }

  const genericClaimsBlocked = matches.filter(
    (m) => m.category === 'generic_eco' && m.severity === 'blocker',
  ).length;
  const carbonOffsetClaimsBlocked = matches.filter(
    (m) => m.category === 'carbon_offset' && m.severity === 'blocker',
  ).length;
  const futureTargetWarnings = matches.filter(
    (m) => m.category === 'unverified_future_target' && m.severity === 'blocker',
  ).length;

  return {
    scannedTextLength: copy.trim().length,
    genericClaimsBlocked,
    carbonOffsetClaimsBlocked,
    futureTargetWarnings,
    matches,
    hasBlockingClaims: matches.some((m) => m.severity === 'blocker'),
  };
}
