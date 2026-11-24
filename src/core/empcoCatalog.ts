import type { EmpcoControlSpec } from './types.ts';

export const EMPCO_TOOL_VERSION = '0.5.0';
export const EMPCO_EFFECTIVE_DATE = '2026-09-27';
export const UCPD_MAX_TURNOVER_FINE_PCT = 4;
export const STATUTORY_LEGAL_GUARANTEE_YEARS = 2;

export const LEGAL_DISCLAIMER_EN =
  'Notice: EmpCoKit is an independent technical readiness tool and is NOT affiliated with or endorsed by the European Commission or any EU national consumer authority. Outputs do not constitute legal counsel; confirm binding compliance with qualified EU consumer law counsel.';

export const LEGAL_DISCLAIMER_AR =
  'تنبيه مهم: أداة EmpCoKit أداة فحص وجاهزية تقنية مستقلة وليست تابعة أو معتمدة من المفوضية الأوروبية أو أي هيئة حماية مستهلك أوروبية. ولا تُعد مخرجاتها استشارة قانونية ملزمة، ويجب التحقق من الامتثال عبر مستشار قانوني مختص في تشريعات الاتحاد الأوروبي.';

export const GENERIC_ECO_CLAIM_PATTERNS: readonly RegExp[] = [
  /\beco[\s-]?friendly\b/gi,
  /\benvironmentally[\s-]+friendly\b/gi,
  /\bnature'?s\s+friend\b/gi,
  /\bplanet[\s-]+friendly\b/gi,
  /\bclimate[\s-]+friendly\b/gi,
  /\becological\b/gi,
  /\bbiodegradable\b/gi,
  /\bgreen\b/gi,
  /\bsustainable\b/gi,
  /صديق(?:ة)? للبيئة/g,
  /أخضر|خضراء/g,
  /مستدام(?:ة)?/g,
];

export const CARBON_OFFSET_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bcarbon[\s-]+neutral\b/gi,
  /\bclimate[\s-]+neutral\b/gi,
  /\bco2[\s-]+neutral\b/gi,
  /\bclimate[\s-]+compensated\b/gi,
  /\bclimate[\s-]+positive\b/gi,
  /\bnet[\s-]+zero\s+product\b/gi,
  /محايد(?:ة)?\s+كربونياً/g,
  /مناخياً\s+محايد/g,
];

export const FUTURE_COMMITMENT_PATTERNS: readonly RegExp[] = [
  /\bnet[\s-]+zero\s+by\s+20\d{2}\b/gi,
  /\bcarbon[\s-]+neutral\s+by\s+20\d{2}\b/gi,
  /\b100%\s+renewable\s+by\s+20\d{2}\b/gi,
  /صافي\s+صفري\s+بحلول/g,
];

export const EMPCO_CONTROLS: readonly EmpcoControlSpec[] = [
  {
    id: 'EMP-CTRL-01',
    weight: 20,
    titleEn: 'Generic Environmental Claim Substantiation (UCPD Annex I 4a)',
    titleAr: 'ضبط وحظر الادعاءات البيئية العامة بدون إثبات معترف به',
    descriptionEn:
      'Remove vague green terms ("eco-friendly", "green", "sustainable") or substantiate via recognized official excellence such as EU Ecolabel.',
    descriptionAr:
      'إزالة العبارات البيئية العامة أو توثيقها بأداء متفوّق معترف به رسمياً مثل علامة EU Ecolabel.',
  },
  {
    id: 'EMP-CTRL-02',
    weight: 20,
    titleEn: 'Zero Offset-Based Carbon Neutrality Ban (UCPD Annex I 4c)',
    titleAr: 'الالتزام بالحظر المطلق لادعاءات الحياد الكربوني بالتعويضات',
    descriptionEn:
      'Prohibit "carbon neutral" or "climate compensated" product claims relying on external GHG offset credits.',
    descriptionAr:
      'منع ترويج أي منتج بصفة "محايد كربونياً" بناءً على شراء أرصدة أو تعويضات كربون خارجية.',
  },
  {
    id: 'EMP-CTRL-03',
    weight: 20,
    titleEn: 'Public or Third-Party Certified Sustainability Labels (UCPD Annex I 2a)',
    titleAr: 'حوكمة ملصقات وشارات الاستدامة المعتمدة فقط',
    descriptionEn:
      'Display only sustainability labels established by public authorities or grounded in independent third-party certification schemes.',
    descriptionAr:
      'استخدام ملصقات الاستدامة الحكومية أو المعتمدة عبر طرف ثالث مستقل ومنع الشارات الذاتية الخاصة.',
  },
  {
    id: 'EMP-CTRL-04',
    weight: 15,
    titleEn: 'Mandatory 2-Year Legal Guarantee Harmonised Notice (Reg. (EU) 2025/1960)',
    titleAr: 'عرض الإشعار الموحد الإلزامي للضمان القانوني (سنتان)',
    descriptionEn:
      'Display the standardised pre-contractual legal guarantee of conformity notice prominently across B2C EU storefronts.',
    descriptionAr:
      'إبراز الإشعار الموحد للضمان القانوني لمدة سنتين قبل التعاقد في كافة نقاط البيع الأوروبية للمستهلكين.',
  },
  {
    id: 'EMP-CTRL-05',
    weight: 15,
    titleEn: 'Conditional GARAN Commercial Durability Label (>2 Years Free)',
    titleAr: 'وسم GARAN لضمان المتانة التجاري (> سنتين مجاناً)',
    descriptionEn:
      'Render the harmonised GARAN label whenever offering a free whole-product commercial durability guarantee exceeding 2 years.',
    descriptionAr:
      'إظهار وسم GARAN الموحد عند تقديم ضمان متانة تجاري مجاني يشمل المنتج بأكمله لأكثر من سنتين.',
  },
  {
    id: 'EMP-CTRL-06',
    weight: 10,
    titleEn: 'Verified Future Commitments & Software/Repairability Disclosures',
    titleAr: 'توثيق الالتزامات البيئية المستقبلية وبيانات الإصلاح والتحديث',
    descriptionEn:
      'Back any future environmental targets with a detailed implementation plan verified regularly by an independent third-party expert.',
    descriptionAr:
      'إسناد أي تعهدات مناخية مستقبلية إلى خطة موضوعية علنية وتدقيق دوري من خبير مستقل طرف ثالث.',
  },
];
