export type SalesChannelScope =
  | 'eu_b2c_online'
  | 'eu_b2c_physical'
  | 'eu_b2b_exempt';

export type SustainabilityLabelKind =
  | 'none'
  | 'eu_ecolabel_public'
  | 'third_party_certified'
  | 'self_certified_private';

export type ReadinessStatus = 'ready' | 'conditional' | 'blocked';

export type SeverityLevel = 'blocker' | 'warning' | 'info';

export type EmpcoControlId =
  | 'EMP-CTRL-01'
  | 'EMP-CTRL-02'
  | 'EMP-CTRL-03'
  | 'EMP-CTRL-04'
  | 'EMP-CTRL-05'
  | 'EMP-CTRL-06';

export interface EmpcoControlSpec {
  id: EmpcoControlId;
  weight: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export interface ClaimMatch {
  category:
    | 'generic_eco'
    | 'carbon_offset'
    | 'whole_product_scope'
    | 'unverified_future_target';
  matchedTerm: string;
  legalRef: string;
  severity: SeverityLevel;
  remediationEn: string;
  remediationAr: string;
}

export interface ClaimsScanResult {
  scannedTextLength: number;
  genericClaimsBlocked: number;
  carbonOffsetClaimsBlocked: number;
  futureTargetWarnings: number;
  matches: ClaimMatch[];
  hasBlockingClaims: boolean;
}

export interface FindingItem {
  code: string;
  severity: SeverityLevel;
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  legalRef: string;
}

export interface GuaranteeEvaluationResult {
  regulationActive: boolean;
  legalGuaranteeNoticeRequired: boolean;
  legalGuaranteeNoticeCompliant: boolean;
  commercialDurabilityYears: number;
  garanLabelRequired: boolean;
  garanLabelCompliant: boolean;
  harmonisedNoticeSnippetEn: string;
  harmonisedNoticeSnippetAr: string;
  findings: FindingItem[];
}

export interface ProductCsvRowAudit {
  rowNumber: number;
  sku: string;
  productName: string;
  labelKind: SustainabilityLabelKind;
  legalNoticeDisplayed: boolean;
  durabilityGuaranteeYears: number;
  garanLabelDisplayed: boolean;
  status: ReadinessStatus;
  issues: string[];
}

export interface ProductCsvAuditSummary {
  totalSkus: number;
  readyCount: number;
  conditionalCount: number;
  blockedCount: number;
  genericClaimHits: number;
  offsetClaimHits: number;
  selfLabelHits: number;
  missingNoticeHits: number;
  rows: ProductCsvRowAudit[];
  parseErrors: string[];
}

export interface ControlEvaluationItem {
  id: EmpcoControlId;
  titleEn: string;
  titleAr: string;
  implemented: boolean;
  weight: number;
}

export interface AssessmentInput {
  organizationName: string;
  productOrStoreName: string;
  assessmentDate: string;
  channelScope: SalesChannelScope;
  annualEuTurnoverEur: number;
  marketingCopy: string;
  hasRecognizedExcellenceProof: boolean;
  labelKind: SustainabilityLabelKind;
  labelSchemeName: string;
  legalGuaranteeNoticeDisplayed: boolean;
  commercialDurabilityYears: number;
  coversEntireProductFreeOfCharge: boolean;
  garanLabelDisplayed: boolean;
  hasFutureCommitmentPlan: boolean;
  hasIndependentThirdPartyVerifier: boolean;
  productCatalogCsv?: string;
  implementedControls: readonly EmpcoControlId[];
  notes?: string;
}

export interface AssessmentResult {
  toolName: 'EmpCoKit';
  version: string;
  legalDisclaimerEn: string;
  legalDisclaimerAr: string;
  organizationName: string;
  productOrStoreName: string;
  assessmentDate: string;
  channelScope: SalesChannelScope;
  maxTurnoverFineExposureEur: number;
  status: ReadinessStatus;
  readinessScore: number;
  claimsScan: ClaimsScanResult;
  guarantee: GuaranteeEvaluationResult;
  catalogAudit: ProductCsvAuditSummary | null;
  controls: ControlEvaluationItem[];
  findings: FindingItem[];
  canonicalDossierText: string;
  dossierSha256: string;
}

export interface EmpcoPreset {
  id: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  input: AssessmentInput;
}
