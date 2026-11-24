import {
  EMPCO_EFFECTIVE_DATE,
  STATUTORY_LEGAL_GUARANTEE_YEARS,
} from './empcoCatalog.ts';
import type {
  AssessmentInput,
  FindingItem,
  GuaranteeEvaluationResult,
} from './types.ts';

export function evaluateGuaranteeNotices(
  input: AssessmentInput,
): GuaranteeEvaluationResult {
  const regulationActive =
    input.assessmentDate.trim() >= EMPCO_EFFECTIVE_DATE;
  const durabilityYears = Math.max(
    0,
    Number(input.commercialDurabilityYears) || 0,
  );
  const findings: FindingItem[] = [];

  if (input.channelScope === 'eu_b2b_exempt') {
    findings.push({
      code: 'EMP-B2B-EXEMPT',
      severity: 'info',
      titleEn: 'B2B Transaction Scope Exempt from B2C EmpCo Guarantee Labels',
      titleAr: 'معاملات B2B مستثناة من ملصقات الضمان الإلزامية للمستهلكين',
      detailEn:
        'Pure B2B supply contracts fall outside UCPD/CRD consumer point-of-sale notice requirements under Regulation (EU) 2025/1960.',
      detailAr:
        'عقود التوريد التجارية الصرفة (B2B) خارج نطاق إشعارات المستهلك قبل التعاقد وفق اللائحة (EU) 2025/1960.',
      legalRef: 'Directive (EU) 2024/825 / Regulation (EU) 2025/1960 Scope',
    });

    return {
      regulationActive,
      legalGuaranteeNoticeRequired: false,
      legalGuaranteeNoticeCompliant: true,
      commercialDurabilityYears: durabilityYears,
      garanLabelRequired: false,
      garanLabelCompliant: true,
      harmonisedNoticeSnippetEn:
        'B2B scope: B2C harmonised legal guarantee notice not required.',
      harmonisedNoticeSnippetAr:
        'نطاق B2B: إشعار الضمان الاستهلاكي غير مطلوب.',
      findings,
    };
  }

  const legalGuaranteeNoticeRequired = true;
  const legalGuaranteeNoticeCompliant = Boolean(
    input.legalGuaranteeNoticeDisplayed,
  );

  if (!legalGuaranteeNoticeCompliant) {
    findings.push({
      code: 'EMP-GUAR-NOTICE-MISSING',
      severity: regulationActive ? 'blocker' : 'warning',
      titleEn:
        'Mandatory Harmonised 2-Year Legal Guarantee Notice Missing (Reg. (EU) 2025/1960)',
      titleAr:
        'الإشعار الموحد الإلزامي للضمان القانوني (سنتان) مفقود من واجهة البيع',
      detailEn: regulationActive
        ? 'Since 2026-09-27, EU B2C traders must display the standardised notice informing consumers of their minimum 2-year legal guarantee of conformity before ordering.'
        : 'Deploy the standardised Regulation (EU) 2025/1960 legal guarantee notice before 2026-09-27.',
      detailAr: regulationActive
        ? 'منذ 2026-09-27 يلزم كل تاجر B2C عرض الإشعار الموحد للضمان القانوني (سنتان على الأقل) بوضوح قبل إتمام الطلب.'
        : 'يجب تفعيل ونشر الإشعار الموحد للضمان القانوني قبل موعد التطبيق 2026-09-27.',
      legalRef: 'Commission Implementing Regulation (EU) 2025/1960 Art. 1',
    });
  }

  const garanLabelRequired =
    durabilityYears > STATUTORY_LEGAL_GUARANTEE_YEARS &&
    Boolean(input.coversEntireProductFreeOfCharge);
  const garanLabelCompliant = !garanLabelRequired || Boolean(input.garanLabelDisplayed);

  if (!garanLabelCompliant) {
    findings.push({
      code: 'EMP-GARAN-LABEL-MISSING',
      severity: regulationActive ? 'blocker' : 'warning',
      titleEn: `Commercial Durability Guarantee (${durabilityYears}y) Missing Harmonised GARAN Label`,
      titleAr: `ضمان المتانة التجاري (${durabilityYears} سنوات) يفتقر لوسم GARAN الموحد`,
      detailEn:
        'Offering a free whole-product commercial durability guarantee exceeding 2 years triggers mandatory display of the standardised Regulation (EU) 2025/1960 GARAN label.',
      detailAr:
        'عند منح ضمان متانة تجاري مجاني يشمل كامل المنتج لمدة تفوق السنتين يجب عرض وسم GARAN الموحد وفق (EU) 2025/1960.',
      legalRef: 'Commission Implementing Regulation (EU) 2025/1960 Annex II (GARAN)',
    });
  }

  const harmonisedNoticeSnippetEn = [
    `STATUTORY NOTICE (Reg. (EU) 2025/1960): Reminder — Under EU law, you are entitled to a minimum ${STATUTORY_LEGAL_GUARANTEE_YEARS}-year free legal guarantee of conformity from delivery from the seller (${input.organizationName}).`,
    garanLabelRequired
      ? `COMMERCIAL DURABILITY LABEL (GARAN): ${input.productOrStoreName} carries a free whole-product producer commercial guarantee of durability of ${durabilityYears} years.`
      : 'GARAN COMMERCIAL LABEL: Not triggered (only mandatory when offering a free whole-product commercial durability guarantee > 2 years).',
  ].join('\n');

  const harmonisedNoticeSnippetAr = [
    `إشعار موحد بالضمان القانوني ((EU) 2025/1960): يحق للمستهلك في الاتحاد الأوروبي ضمان قانوني مجاني للمطابقة لمدة لا تقل عن ${STATUTORY_LEGAL_GUARANTEE_YEARS} سنوات من تاريخ التسليم لدى البائع (${input.organizationName}).`,
    garanLabelRequired
      ? `وسم ضمان المتانة التجاري (GARAN): يشمل ${input.productOrStoreName} ضمان متانة تجارياً مجانياً لكامل المنتج لمدة ${durabilityYears} سنوات.`
      : 'وسم GARAN التجاري: غير مطلوب ما لم يتجاوز الضمان التجاري المجاني الشامل سنتين.',
  ].join('\n');

  return {
    regulationActive,
    legalGuaranteeNoticeRequired,
    legalGuaranteeNoticeCompliant,
    commercialDurabilityYears: durabilityYears,
    garanLabelRequired,
    garanLabelCompliant,
    harmonisedNoticeSnippetEn,
    harmonisedNoticeSnippetAr,
    findings,
  };
}
