export type {
  AssessmentInput,
  AssessmentResult,
  ClaimMatch,
  ClaimsScanResult,
  ControlEvaluationItem,
  EmpcoControlId,
  EmpcoControlSpec,
  EmpcoPreset,
  FindingItem,
  GuaranteeEvaluationResult,
  ProductCsvAuditSummary,
  ProductCsvRowAudit,
  ReadinessStatus,
  SalesChannelScope,
  SeverityLevel,
  SustainabilityLabelKind,
} from './types.ts';

export {
  CARBON_OFFSET_CLAIM_PATTERNS,
  EMPCO_CONTROLS,
  EMPCO_EFFECTIVE_DATE,
  EMPCO_TOOL_VERSION,
  FUTURE_COMMITMENT_PATTERNS,
  GENERIC_ECO_CLAIM_PATTERNS,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  STATUTORY_LEGAL_GUARANTEE_YEARS,
  UCPD_MAX_TURNOVER_FINE_PCT,
} from './empcoCatalog.ts';

export { scanMarketingClaims } from './claimsScanner.ts';
export { evaluateGuaranteeNotices } from './guaranteeNoticeEngine.ts';
export {
  auditProductCatalogCsv,
  exportProductCatalogAuditCsv,
  sanitizeCsvCell,
} from './productCsvAuditor.ts';
export {
  canonicalizeDossierPayload,
  computeDossierSha256,
  computePayloadDigest,
} from './dossierDigest.ts';
export { assessEmpcoReadiness } from './readinessAssessor.ts';
export { buildEmpcoBriefMarkdown } from './briefBuilder.ts';
export { EMPCO_PRESETS } from './presets.ts';
