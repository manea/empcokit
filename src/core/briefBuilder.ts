import type { AssessmentInput, AssessmentResult } from './types.ts';

export function buildEmpcoBriefMarkdown(
  input: AssessmentInput,
  result: AssessmentResult,
  dossierCode = 'DRAFT',
  sha256Digest = result.dossierSha256,
  locale: 'en' | 'ar' = 'en',
): string {
  const digest = sha256Digest || result.dossierSha256;
  const g = result.guarantee;
  const c = result.claimsScan;
  const implemented = result.controls.filter((item) => item.implemented).map((item) => item.id);
  const missing = result.controls.filter((item) => !item.implemented).map((item) => item.id);

  if (locale === 'ar') {
    const lines: string[] = [
      `# ملف جاهزية الامتثال الأوروبي (EmpCoKit — EU 2024/825 & 2025/1960) — ${dossierCode}`,
      '',
      `> **تنويه تنظيمي إلزامي**: ${result.legalDisclaimerAr}`,
      '',
      `- **المؤسسة**: ${result.organizationName}`,
      `- **المنتج / المتجر**: ${result.productOrStoreName}`,
      `- **نطاق قناة البيع**: \`${result.channelScope}\` · **تاريخ التقييم**: ${result.assessmentDate}`,
      `- **حالة الجاهزية الإجمالية**: \`${result.status.toUpperCase()}\` (${result.readinessScore}/100)`,
      `- **سقف التعرض لغرامة المبيعات (UCPD 4%)**: EUR ${result.maxTurnoverFineExposureEur.toLocaleString('en-US')}`,
      `- **بصمة SHA-256 المعيارية**: \`${digest}\``,
      '',
      '## 1. فحص الادعاءات البيئية وتعويضات الكربون والشارات (`Directive (EU) 2024/825`)',
      `- الادعاءات البيئية العامة المحظورة (` +
        '`Annex I 4a`' +
        `): ${c.genericClaimsBlocked}`,
      `- ادعاءات الحياد الكربوني بالتعويضات (` +
        '`Annex I 4c`' +
        `): ${c.carbonOffsetClaimsBlocked}`,
      `- تنبيهات الأهداف المستقبلية غير المدققة (` +
        '`Art. 6(2)(d)`' +
        `): ${c.futureTargetWarnings}`,
      `- نوع وسم الاستدامة: \`${input.labelKind}\` (${input.labelSchemeName || 'لا يوجد'})`,
      '',
      '## 2. إشعار الضمان القانوني الموحّد ووسم المتانة `GARAN` (`Regulation (EU) 2025/1960`)',
      `- اللائحة سارية اعتباراً من 2026-09-27؟ ${g.regulationActive ? 'نعم' : 'لا (فترة تجهيز قبل السريان)'}`,
      `- إشعار الضمان القانوني (سنتان) معروض؟ ${g.legalGuaranteeNoticeRequired ? (g.legalGuaranteeNoticeCompliant ? 'نعم (ممتثل)' : 'لا (مخالفة حاجبة)') : 'معفى (B2B صرف)'}`,
      `- ضمان المتانة التجاري المجاني: ${g.commercialDurabilityYears} سنة · وسم \`GARAN\` مطلوب؟ ${g.garanLabelRequired ? (g.garanLabelCompliant ? 'نعم ومعروض' : 'نعم ومفقود') : 'لا (> 2 سنة غير منطبق)'}`,
      '',
    ];

    if (result.catalogAudit) {
      const a = result.catalogAudit;
      lines.push(
        '## 3. تدقيق كتالوج المنتجات `CSV` (`CWE-1236 Safe`)',
        `- إجمالي المنتجات (SKUs): ${a.totalSkus} · ممتثل: ${a.readyCount} · مشروط: ${a.conditionalCount} · محجوب: ${a.blockedCount}`,
        `- الادعاءات العامة: ${a.genericClaimHits} · التعويضات الكربونية: ${a.offsetClaimHits} · الشارات الذاتية: ${a.selfLabelHits} · نقص الإشعارات: ${a.missingNoticeHits}`,
        '',
      );
    }

    lines.push(
      '## 4. الضوابط التشغيلية الستة (`EmpCo Controls`)',
      `- المستوفاة (${implemented.length}/6): ${implemented.length > 0 ? implemented.join(', ') : 'لا يوجد'}`,
      `- الناقصة (${missing.length}/6): ${missing.length > 0 ? missing.join(', ') : 'لا يوجد'}`,
      '',
      '## 5. النتائج والملاحظات التنفيذية',
      ...result.findings.map(
        (f) => `- [${f.severity.toUpperCase()} · ${f.code} · ${f.legalRef}] ${f.titleAr}: ${f.detailAr}`,
      ),
    );

    if (input.notes?.trim()) {
      lines.push('', '## 6. ملاحظات تشغيلية مرفقة', input.notes.trim());
    }
    return `${lines.join('\n')}\n`;
  }

  const lines: string[] = [
    `# EU EmpCo Readiness Dossier (EmpCoKit — Directive 2024/825 & Reg. 2025/1960) — ${dossierCode}`,
    '',
    `> **Mandatory Disclaimer**: ${result.legalDisclaimerEn}`,
    '',
    `- **Organization**: ${result.organizationName}`,
    `- **Product / Storefront**: ${result.productOrStoreName}`,
    `- **Sales Channel Scope**: \`${result.channelScope}\` · **Assessment Date**: ${result.assessmentDate}`,
    `- **Overall Readiness**: \`${result.status.toUpperCase()}\` (${result.readinessScore}/100)`,
    `- **Max EU Turnover Fine Exposure (4% UCPD Cap)**: EUR ${result.maxTurnoverFineExposureEur.toLocaleString('en-US')}`,
    `- **Canonical SHA-256 Digest**: \`${digest}\``,
    '',
    '## 1. Greenwashing, Carbon-Offset & Label Scan (`Directive (EU) 2024/825`)',
    `- Blocked Generic Eco Claims (\`Annex I 4a\`): ${c.genericClaimsBlocked}`,
    `- Blocked Carbon-Offset Neutrality Claims (\`Annex I 4c\`): ${c.carbonOffsetClaimsBlocked}`,
    `- Unverified Future Target Warnings (\`Art. 6(2)(d)\`): ${c.futureTargetWarnings}`,
    `- Sustainability Label Kind: \`${input.labelKind}\` (${input.labelSchemeName || 'None'})`,
    '',
    '## 2. Legal Guarantee Notice & Conditional `GARAN` Durability Label (`Regulation (EU) 2025/1960`)',
    `- Enforcement Active (>= 2026-09-27)?: ${g.regulationActive ? 'YES' : 'NO (Pre-Cutoff Prep)'}`,
    `- Mandatory 2-Year Legal Guarantee Notice: ${g.legalGuaranteeNoticeRequired ? (g.legalGuaranteeNoticeCompliant ? 'DISPLAYED (Compliant)' : 'MISSING (Blocker)') : 'EXEMPT (Pure B2B)'}`,
    `- Commercial Durability Guarantee: ${g.commercialDurabilityYears}y · \`GARAN\` Required?: ${g.garanLabelRequired ? (g.garanLabelCompliant ? 'YES & DISPLAYED' : 'YES & MISSING') : 'NO (<= 2y or non-free)'}`,
    '',
  ];

  if (result.catalogAudit) {
    const a = result.catalogAudit;
    lines.push(
      '## 3. Product Catalog CSV Audit (`CWE-1236 Safe`)',
      `- Total SKUs: ${a.totalSkus} · Ready: ${a.readyCount} · Conditional: ${a.conditionalCount} · Blocked: ${a.blockedCount}`,
      `- Generic Eco Hits: ${a.genericClaimHits} · Carbon-Offset Hits: ${a.offsetClaimHits} · Self-Certified Labels: ${a.selfLabelHits} · Missing Notices: ${a.missingNoticeHits}`,
      '',
    );
  }

  lines.push(
    '## 4. Six EmpCo Compliance Controls',
    `- Implemented (${implemented.length}/6): ${implemented.length > 0 ? implemented.join(', ') : 'None'}`,
    `- Missing (${missing.length}/6): ${missing.length > 0 ? missing.join(', ') : 'None'}`,
    '',
    '## 5. Compliance Findings',
    ...result.findings.map(
      (f) => `- [${f.severity.toUpperCase()} · ${f.code} · ${f.legalRef}] ${f.titleEn}: ${f.detailEn}`,
    ),
  );

  if (input.notes?.trim()) {
    lines.push('', '## 6. Attached Operational Notes', input.notes.trim());
  }
  return `${lines.join('\n')}\n`;
}
