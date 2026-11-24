import { describe, expect, it } from 'vitest';
import {
  EMPCO_PRESETS,
  assessEmpcoReadiness,
  auditProductCatalogCsv,
  evaluateGuaranteeNotices,
  exportProductCatalogAuditCsv,
  sanitizeCsvCell,
  scanMarketingClaims,
} from '../../src/core/index.ts';

describe('Directive (EU) 2024/825 Greenwashing & Offset Claims Scanner', () => {
  it('blocks unproven generic eco claims under UCPD Annex I 4a unless official excellence proof is held', () => {
    const blocked = scanMarketingClaims({
      marketingCopy: 'Buy our Eco-Friendly and Sustainable insulated bottle.',
      hasRecognizedExcellenceProof: false,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
    });
    expect(blocked.hasBlockingClaims).toBe(true);
    expect(blocked.genericClaimsBlocked).toBeGreaterThanOrEqual(2);

    const substantiated = scanMarketingClaims({
      marketingCopy: 'Our Eco-Friendly paint carries EU Ecolabel certification.',
      hasRecognizedExcellenceProof: true,
      hasFutureCommitmentPlan: true,
      hasIndependentThirdPartyVerifier: true,
    });
    expect(substantiated.hasBlockingClaims).toBe(false);
    expect(substantiated.genericClaimsBlocked).toBe(0);
    expect(substantiated.matches[0]?.severity).toBe('info');
  });

  it('unconditionally blocks carbon-offset product neutrality claims under UCPD Annex I 4c', () => {
    const res = scanMarketingClaims({
      marketingCopy: 'EU Ecolabel certified yet Carbon Neutral by offsetting shipping.',
      hasRecognizedExcellenceProof: true,
      hasFutureCommitmentPlan: true,
      hasIndependentThirdPartyVerifier: true,
    });
    expect(res.hasBlockingClaims).toBe(true);
    expect(res.carbonOffsetClaimsBlocked).toBe(1);
    expect(res.matches[0]?.category).toBe('carbon_offset');
  });

  it('requires public plan and independent third-party verifier for future climate commitments (Art. 6(2)(d))', () => {
    const missing = scanMarketingClaims({
      marketingCopy: 'Net zero by 2040 across operations.',
      hasRecognizedExcellenceProof: false,
      hasFutureCommitmentPlan: true,
      hasIndependentThirdPartyVerifier: false,
    });
    expect(missing.hasBlockingClaims).toBe(true);
    expect(missing.futureTargetWarnings).toBe(1);

    const verified = scanMarketingClaims({
      marketingCopy: 'Net zero by 2040 across operations.',
      hasRecognizedExcellenceProof: false,
      hasFutureCommitmentPlan: true,
      hasIndependentThirdPartyVerifier: true,
    });
    expect(verified.hasBlockingClaims).toBe(false);
    expect(verified.futureTargetWarnings).toBe(0);
  });
});

describe('Regulation (EU) 2025/1960 Legal Guarantee & GARAN Durability Labels', () => {
  it('enforces mandatory 2-year legal guarantee notice and >2y GARAN durability label from 2026-09-27', () => {
    const missingPostCutoff = evaluateGuaranteeNotices({
      organizationName: 'NordTech AB',
      productOrStoreName: 'Smart Toaster Pro',
      assessmentDate: '2026-10-01',
      channelScope: 'eu_b2c_online',
      annualEuTurnoverEur: 4_000_000,
      marketingCopy: 'Stainless steel chassis.',
      hasRecognizedExcellenceProof: false,
      labelKind: 'none',
      labelSchemeName: '',
      legalGuaranteeNoticeDisplayed: false,
      commercialDurabilityYears: 4,
      coversEntireProductFreeOfCharge: true,
      garanLabelDisplayed: false,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
      implementedControls: [],
    });

    expect(missingPostCutoff.regulationActive).toBe(true);
    expect(missingPostCutoff.legalGuaranteeNoticeRequired).toBe(true);
    expect(missingPostCutoff.legalGuaranteeNoticeCompliant).toBe(false);
    expect(missingPostCutoff.garanLabelRequired).toBe(true);
    expect(missingPostCutoff.garanLabelCompliant).toBe(false);
    expect(
      missingPostCutoff.findings.filter((f) => f.severity === 'blocker'),
    ).toHaveLength(2);
  });

  it('does not trigger GARAN label for <=2y guarantees and exempts pure B2B sales', () => {
    const twoYearB2c = evaluateGuaranteeNotices({
      organizationName: 'NordTech AB',
      productOrStoreName: 'Coffee Kettle',
      assessmentDate: '2026-10-01',
      channelScope: 'eu_b2c_physical',
      annualEuTurnoverEur: 2_000_000,
      marketingCopy: '2-year standard parts.',
      hasRecognizedExcellenceProof: false,
      labelKind: 'none',
      labelSchemeName: '',
      legalGuaranteeNoticeDisplayed: true,
      commercialDurabilityYears: 2,
      coversEntireProductFreeOfCharge: true,
      garanLabelDisplayed: false,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
      implementedControls: ['EMP-CTRL-04'],
    });
    expect(twoYearB2c.garanLabelRequired).toBe(false);
    expect(twoYearB2c.garanLabelCompliant).toBe(true);
    expect(twoYearB2c.harmonisedNoticeSnippetEn).toContain('minimum 2-year');

    const b2bExempt = evaluateGuaranteeNotices({
      organizationName: 'Industrial Valve GmbH',
      productOrStoreName: 'Pump X9',
      assessmentDate: '2026-10-01',
      channelScope: 'eu_b2b_exempt',
      annualEuTurnoverEur: 10_000_000,
      marketingCopy: 'Factory pump.',
      hasRecognizedExcellenceProof: false,
      labelKind: 'none',
      labelSchemeName: '',
      legalGuaranteeNoticeDisplayed: false,
      commercialDurabilityYears: 5,
      coversEntireProductFreeOfCharge: true,
      garanLabelDisplayed: false,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
      implementedControls: [],
    });
    expect(b2bExempt.legalGuaranteeNoticeRequired).toBe(false);
    expect(b2bExempt.findings[0]?.code).toBe('EMP-B2B-EXEMPT');
  });

  it('blocks self-certified private sustainability badges under UCPD Annex I 2a', async () => {
    const res = await assessEmpcoReadiness({
      organizationName: 'Aura Goods Ltd',
      productOrStoreName: 'PurePack Tray',
      assessmentDate: '2026-10-10',
      channelScope: 'eu_b2c_online',
      annualEuTurnoverEur: 1_000_000,
      marketingCopy: 'Recycled cardboard tray.',
      hasRecognizedExcellenceProof: false,
      labelKind: 'self_certified_private',
      labelSchemeName: 'Our Own GreenHeart Seal',
      legalGuaranteeNoticeDisplayed: true,
      commercialDurabilityYears: 2,
      coversEntireProductFreeOfCharge: false,
      garanLabelDisplayed: false,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
      implementedControls: ['EMP-CTRL-01', 'EMP-CTRL-02', 'EMP-CTRL-04'],
    });

    expect(res.status).toBe('blocked');
    expect(res.findings.some((f) => f.code === 'EMP-SELF-CERTIFIED-LABEL')).toBe(
      true,
    );
    expect(res.maxTurnoverFineExposureEur).toBe(40000);
  });
});

describe('Product Catalog CSV Auditor & CWE-1236 Safe Exporter', () => {
  it('audits multi-SKU catalogs and detects generic claims, offsets, private badges, and missing notices', () => {
    const csv = [
      'sku,product_name,marketing_copy,label_kind,legal_notice_displayed,durability_years,garan_label_displayed',
      'A1,Clean Mug,Ceramic mug fired at 1200C,none,true,2,false',
      'A2,Greenwash Bottle,100% Eco-Friendly & Carbon Neutral flask,self_certified_private,false,5,false',
    ].join('\n');

    const audit = auditProductCatalogCsv(csv, '2026-10-15');
    expect(audit.totalSkus).toBe(2);
    expect(audit.readyCount).toBe(1);
    expect(audit.blockedCount).toBe(1);
    expect(audit.genericClaimHits).toBe(1);
    expect(audit.offsetClaimHits).toBe(1);
    expect(audit.selfLabelHits).toBe(1);
    expect(audit.missingNoticeHits).toBe(1);
  });

  it('escapes formula injection prefixes against CWE-1236 and exports UTF-8 BOM CSV', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(sanitizeCsvCell('-2*3')).toBe("'-2*3");
    expect(sanitizeCsvCell('@CMD')).toBe("'@CMD");

    const csv = [
      'sku,product_name,marketing_copy,label_kind,legal_notice_displayed,durability_years,garan_label_displayed',
      'S-1,"=HYPERLINK(""http://evil"")",Standard cotton towel,none,true,2,false',
    ].join('\n');

    const audit = auditProductCatalogCsv(csv, '2026-10-15');
    const exported = exportProductCatalogAuditCsv(audit);
    expect(exported.startsWith('\uFEFF')).toBe(true);
    expect(exported).toContain('"\'=HYPERLINK(""http://evil"")"');
  });
});

describe('EmpCo Presets, 4% Turnover Cap, SHA-256 Digest & Non-Legal Disclaimer', () => {
  it('evaluates all 3 EMPCO_PRESETS cleanly with 4% max turnover fine calculation, digest & disclaimers', async () => {
    expect(EMPCO_PRESETS).toHaveLength(3);

    const readyRes = await assessEmpcoReadiness(EMPCO_PRESETS[0]!.input);
    expect(readyRes.status).toBe('ready');
    expect(readyRes.readinessScore).toBe(100);
    expect(readyRes.maxTurnoverFineExposureEur).toBe(0);
    expect(readyRes.guarantee.garanLabelRequired).toBe(true);
    expect(readyRes.guarantee.garanLabelCompliant).toBe(true);

    const conditionalRes = await assessEmpcoReadiness(EMPCO_PRESETS[1]!.input);
    expect(conditionalRes.status).toBe('conditional');
    expect(conditionalRes.maxTurnoverFineExposureEur).toBe(0);
    expect(conditionalRes.guarantee.regulationActive).toBe(false);

    const blockedRes = await assessEmpcoReadiness(EMPCO_PRESETS[2]!.input);
    expect(blockedRes.status).toBe('blocked');
    expect(blockedRes.maxTurnoverFineExposureEur).toBe(1_000_000);
    expect(blockedRes.claimsScan.genericClaimsBlocked).toBeGreaterThanOrEqual(1);
    expect(blockedRes.claimsScan.carbonOffsetClaimsBlocked).toBeGreaterThanOrEqual(
      1,
    );
    expect(blockedRes.catalogAudit?.blockedCount).toBe(2);

    expect(blockedRes.dossierSha256).toMatch(/^[a-f0-9]{64}$/);
    const repeat = await assessEmpcoReadiness(EMPCO_PRESETS[2]!.input);
    expect(repeat.dossierSha256).toBe(blockedRes.dossierSha256);

    expect(readyRes.legalDisclaimerEn).toContain('NOT affiliated');
    expect(readyRes.legalDisclaimerAr).toContain('ليست تابعة');
  });
});
