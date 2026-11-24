import { scanMarketingClaims } from './claimsScanner.ts';
import {
  canonicalizeDossierPayload,
  computePayloadDigest,
} from './dossierDigest.ts';
import {
  EMPCO_CONTROLS,
  EMPCO_TOOL_VERSION,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  UCPD_MAX_TURNOVER_FINE_PCT,
} from './empcoCatalog.ts';
import { evaluateGuaranteeNotices } from './guaranteeNoticeEngine.ts';
import { auditProductCatalogCsv } from './productCsvAuditor.ts';
import type {
  AssessmentInput,
  AssessmentResult,
  ControlEvaluationItem,
  EmpcoControlId,
  FindingItem,
  ReadinessStatus,
} from './types.ts';

export async function assessEmpcoReadiness(
  input: AssessmentInput,
): Promise<AssessmentResult> {
  const claimsScan = scanMarketingClaims({
    marketingCopy: input.marketingCopy,
    hasRecognizedExcellenceProof: input.hasRecognizedExcellenceProof,
    hasFutureCommitmentPlan: input.hasFutureCommitmentPlan,
    hasIndependentThirdPartyVerifier: input.hasIndependentThirdPartyVerifier,
  });

  const guarantee = evaluateGuaranteeNotices(input);

  const hasCatalogCsv =
    typeof input.productCatalogCsv === 'string' &&
    input.productCatalogCsv.trim().length > 0;
  const catalogAudit = hasCatalogCsv
    ? auditProductCatalogCsv(input.productCatalogCsv!, input.assessmentDate)
    : null;

  const findings: FindingItem[] = [];

  for (const match of claimsScan.matches) {
    findings.push({
      code:
        match.category === 'carbon_offset'
          ? 'EMP-OFFSET-CLAIM'
          : match.category === 'generic_eco'
            ? 'EMP-GENERIC-CLAIM'
            : 'EMP-FUTURE-TARGET',
      severity: match.severity,
      titleEn: `${match.category.toUpperCase()}: "${match.matchedTerm}"`,
      titleAr: `فحص الادعاء "${match.matchedTerm}"`,
      detailEn: match.remediationEn,
      detailAr: match.remediationAr,
      legalRef: match.legalRef,
    });
  }

  if (input.labelKind === 'self_certified_private') {
    findings.push({
      code: 'EMP-SELF-CERTIFIED-LABEL',
      severity: 'blocker',
      titleEn: `Banned Self-Certified Sustainability Label (${input.labelSchemeName || 'Private Badge'})`,
      titleAr: `شارة استدامة ذاتية محظورة (${input.labelSchemeName || 'وسم خاص'})`,
      detailEn:
        'Displaying a private sustainability label not grounded in an independent third-party certification scheme or public authority is unconditionally prohibited under UCPD Annex I point 2a.',
      detailAr:
        'يُحظر عرض أي وسم استدامة غير صادر عن سلطة عامة أو غير مستند إلى نظام اعتماد مستقل لطرف ثالث وفق الملحق الأول نقطة 2a.',
      legalRef: 'Directive (EU) 2024/825 (UCPD Annex I, point 2a)',
    });
  }

  findings.push(...guarantee.findings);

  if (catalogAudit) {
    if (catalogAudit.parseErrors.length > 0) {
      findings.push({
        code: 'EMP-CSV-PARSE-ERROR',
        severity: 'blocker',
        titleEn: 'Product Catalog CSV Validation Error',
        titleAr: 'خطأ في بنية ملف كتالوج المنتجات CSV',
        detailEn: catalogAudit.parseErrors.join('; '),
        detailAr: catalogAudit.parseErrors.join(' ؛ '),
        legalRef: 'EmpCoKit CSV Input Validation',
      });
    } else if (catalogAudit.blockedCount > 0) {
      findings.push({
        code: 'EMP-CSV-BLOCKED-SKUS',
        severity: 'blocker',
        titleEn: `${catalogAudit.blockedCount} SKU(s) in Product Catalog Have Blocking EmpCo Violations`,
        titleAr: `رصد ${catalogAudit.blockedCount} منتجاً في كتالوج CSV بمخالفات محظورة`,
        detailEn: `CSV audit flagged ${catalogAudit.genericClaimHits} generic claim hit(s), ${catalogAudit.offsetClaimHits} offset hit(s), ${catalogAudit.selfLabelHits} private label(s), and ${catalogAudit.missingNoticeHits} missing notice(s).`,
        detailAr: `كشف فحص CSV: ${catalogAudit.genericClaimHits} ادعاء عاماً، ${catalogAudit.offsetClaimHits} تعويض كربون، ${catalogAudit.selfLabelHits} شارة خاصة، و${catalogAudit.missingNoticeHits} نقص إشعار ضمان.`,
        legalRef: 'Directive (EU) 2024/825 & Regulation (EU) 2025/1960',
      });
    } else if (catalogAudit.conditionalCount > 0) {
      findings.push({
        code: 'EMP-CSV-CONDITIONAL-SKUS',
        severity: 'warning',
        titleEn: `${catalogAudit.conditionalCount} Pre-Cutoff SKU(s) Need Notice Deployment Before 2026-09-27`,
        titleAr: `${catalogAudit.conditionalCount} منتجات تحتاج تفعيل إشعار الضمان قبل 2026-09-27`,
        detailEn: 'Update product pages with Regulation (EU) 2025/1960 notices prior to cutoff.',
        detailAr: 'قم بتحديث صفحات المنتجات بإشعارات الضمان قبل موعد السريان 2026-09-27.',
        legalRef: 'Regulation (EU) 2025/1960 Readiness',
      });
    }
  }

  const implementedSet: ReadonlySet<EmpcoControlId> = new Set(
    input.implementedControls,
  );
  const controls: ControlEvaluationItem[] = EMPCO_CONTROLS.map((ctrl) => ({
    id: ctrl.id,
    titleEn: ctrl.titleEn,
    titleAr: ctrl.titleAr,
    implemented: implementedSet.has(ctrl.id),
    weight: ctrl.weight,
  }));

  const missingControlCount = controls.filter((c) => !c.implemented).length;
  const controlScore = controls.reduce(
    (sum, item) => sum + (item.implemented ? item.weight : 0),
    0,
  );

  const hasBlocker = findings.some((f) => f.severity === 'blocker');
  const hasWarning = findings.some((f) => f.severity === 'warning');

  let status: ReadinessStatus;
  if (hasBlocker) {
    status = 'blocked';
  } else if (hasWarning || missingControlCount > 0) {
    status = 'conditional';
  } else {
    status = 'ready';
  }

  let readinessScore = controlScore;
  if (claimsScan.carbonOffsetClaimsBlocked > 0) readinessScore -= 25;
  if (claimsScan.genericClaimsBlocked > 0) readinessScore -= 20;
  if (input.labelKind === 'self_certified_private') readinessScore -= 15;
  if (!guarantee.legalGuaranteeNoticeCompliant) readinessScore -= 15;
  if (!guarantee.garanLabelCompliant) readinessScore -= 10;
  if (catalogAudit && catalogAudit.blockedCount > 0) {
    readinessScore -= Math.min(25, catalogAudit.blockedCount * 8);
  }
  readinessScore = Math.max(0, Math.min(100, readinessScore));
  if (status === 'blocked') {
    readinessScore = Math.min(readinessScore, 55);
  } else if (status === 'conditional') {
    readinessScore = Math.min(readinessScore, 88);
  }

  const turnover = Math.max(0, Number(input.annualEuTurnoverEur) || 0);
  const maxTurnoverFineExposureEur =
    status === 'blocked' && input.channelScope !== 'eu_b2b_exempt'
      ? Math.round((turnover * UCPD_MAX_TURNOVER_FINE_PCT) / 100)
      : 0;

  const digestInput = {
    version: EMPCO_TOOL_VERSION,
    organizationName: input.organizationName,
    productOrStoreName: input.productOrStoreName,
    assessmentDate: input.assessmentDate,
    channelScope: input.channelScope,
    labelKind: input.labelKind,
    legalGuaranteeNoticeDisplayed: input.legalGuaranteeNoticeDisplayed,
    commercialDurabilityYears: input.commercialDurabilityYears,
    garanLabelDisplayed: input.garanLabelDisplayed,
    status,
    readinessScore,
    maxTurnoverFineExposureEur,
    implementedControls: [...implementedSet].sort(),
  };

  const canonicalDossierText = canonicalizeDossierPayload(digestInput);
  const dossierSha256 = await computePayloadDigest(canonicalDossierText);

  return {
    toolName: 'EmpCoKit',
    version: EMPCO_TOOL_VERSION,
    legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
    legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
    organizationName: input.organizationName,
    productOrStoreName: input.productOrStoreName,
    assessmentDate: input.assessmentDate,
    channelScope: input.channelScope,
    maxTurnoverFineExposureEur,
    status,
    readinessScore,
    claimsScan,
    guarantee,
    catalogAudit,
    controls,
    findings,
    canonicalDossierText,
    dossierSha256,
  };
}
