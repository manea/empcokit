import type { EmpcoPreset } from './types.ts';

const PRESET_3_CATALOG_CSV = [
  'sku,product_name,marketing_copy,label_kind,legal_notice_displayed,durability_years,garan_label_displayed',
  'SKU-101,NordicRunner Shoe,"100% Eco-Friendly & Carbon Neutral running shoe",self_certified_private,false,3,false',
  'SKU-102,UrbanPack 20L,"100% recycled PET shell verified under GRS (EU Reg. 2025/1960 ready)",third_party_certified,true,2,false',
  'SKU-103,"=HYPERLINK(""http://bad"")","Clean green packaging made with FSC mix",none,true,0,false',
].join('\n');

export const EMPCO_PRESETS: readonly EmpcoPreset[] = [
  {
    id: 'eu-ecolabel-appliance-ready',
    labelEn: 'EU Ecolabel Appliance Store (Ready — 2y Legal + 5y GARAN Label)',
    labelAr: 'متجر أجهزة أوروبية (ممتثل — EU Ecolabel + إشعار سنتين + وسم GARAN 5 سنوات)',
    descriptionEn:
      'Compliant EU B2C storefront post-2026-09-27 with EU Ecolabel substantiation, 2-year legal guarantee notice, and 5-year free GARAN label.',
    descriptionAr:
      'واجهة بيع أوروبية مكتملة بشهادة EU Ecolabel، وإشعار السنتين القانوني، ووسم GARAN لضمان المتانة 5 سنوات.',
    input: {
      organizationName: 'RheinHaus Appliances GmbH',
      productOrStoreName: 'AquaSpin Pro EU Ecolabel Washer',
      assessmentDate: '2026-10-15',
      channelScope: 'eu_b2c_online',
      annualEuTurnoverEur: 12_000_000,
      marketingCopy:
        'EU Ecolabel (DE/038/112) certified washing machine reducing cycle energy by 22% under EN 60456.',
      hasRecognizedExcellenceProof: true,
      labelKind: 'eu_ecolabel_public',
      labelSchemeName: 'EU Ecolabel',
      legalGuaranteeNoticeDisplayed: true,
      commercialDurabilityYears: 5,
      coversEntireProductFreeOfCharge: true,
      garanLabelDisplayed: true,
      hasFutureCommitmentPlan: true,
      hasIndependentThirdPartyVerifier: true,
      implementedControls: [
        'EMP-CTRL-01',
        'EMP-CTRL-02',
        'EMP-CTRL-03',
        'EMP-CTRL-04',
        'EMP-CTRL-05',
        'EMP-CTRL-06',
      ],
    },
  },
  {
    id: 'apparel-brand-pre-cutoff-conditional',
    labelEn: 'Pre-Cutoff EU Apparel Brand (Conditional — Deploy 2y Notice)',
    labelAr: 'علامة ملابس قبل السريان (مشروطة — تجهيز إشعار الضمان قبل 2026-09-27)',
    descriptionEn:
      'GOTS-certified brand evaluated in July 2026 before the 2026-09-27 enforcement date; clean marketing copy, missing 2-year storefront notice.',
    descriptionAr:
      'تقييم قبل موعد 2026-09-27 بنص نظيف وشهادة طرف ثالث GOTS مع ضرورة إضافة إشعار الضمان القانوني للمستهلك.',
    input: {
      organizationName: 'Loire Textiles SAS',
      productOrStoreName: 'Organic Cotton Travel Shirt (GOTS)',
      assessmentDate: '2026-07-01',
      channelScope: 'eu_b2c_online',
      annualEuTurnoverEur: 5_000_000,
      marketingCopy:
        'GOTS-certified organic cotton spun and dyed in Portugal under ISO 14001 facility standards.',
      hasRecognizedExcellenceProof: true,
      labelKind: 'third_party_certified',
      labelSchemeName: 'GOTS',
      legalGuaranteeNoticeDisplayed: false,
      commercialDurabilityYears: 2,
      coversEntireProductFreeOfCharge: true,
      garanLabelDisplayed: false,
      hasFutureCommitmentPlan: true,
      hasIndependentThirdPartyVerifier: true,
      implementedControls: [
        'EMP-CTRL-01',
        'EMP-CTRL-02',
        'EMP-CTRL-03',
        'EMP-CTRL-05',
        'EMP-CTRL-06',
      ],
    },
  },
  {
    id: 'greenwashed-carbon-neutral-store-blocked',
    labelEn: 'Greenwashed & Offset Claims Store (Blocked — EUR 1M Exposure)',
    labelAr: 'متجر بمخالفات الغسل الأخضر والحياد الكربوني (محجوب — تعرض 4% = 1,000,000 يورو)',
    descriptionEn:
      'Post-2026-09-27 store with EUR 25M EU turnover promoting banned "Eco-Friendly & Carbon Neutral" claims, self-certified badge, missing 2y/GARAN notices & blocked CSV SKUs.',
    descriptionAr:
      'متجر بمبيعات 25 مليون يورو يروّج "صديق للبيئة ومحايد كربونياً" بشارة ذاتية مرفوضة وغياب إشعارات الضمان وملف CSV مخالف.',
    input: {
      organizationName: 'Veloce E-Retail BV',
      productOrStoreName: 'NordicRunner Carbon-Neutral Line',
      assessmentDate: '2026-10-20',
      channelScope: 'eu_b2c_online',
      annualEuTurnoverEur: 25_000_000,
      marketingCopy:
        '100% Eco-Friendly & Carbon Neutral sneakers with our internal GreenLeaf badge.',
      hasRecognizedExcellenceProof: false,
      labelKind: 'self_certified_private',
      labelSchemeName: 'Internal GreenLeaf Seal',
      legalGuaranteeNoticeDisplayed: false,
      commercialDurabilityYears: 3,
      coversEntireProductFreeOfCharge: true,
      garanLabelDisplayed: false,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
      productCatalogCsv: PRESET_3_CATALOG_CSV,
      implementedControls: ['EMP-CTRL-06'],
    },
  },
];
