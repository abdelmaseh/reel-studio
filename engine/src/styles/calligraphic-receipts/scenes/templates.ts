// Illustrative editable placeholders; the creator supplies every published number.
export const receiptsTemplateData = {
  'claim-proof': {claim: ['الترتيب', 'بيوفر', 'وقت'], keyIndex: 2,
    rows: [{label: 'قبل', value: 40}, {label: 'بعد', value: 15}], diff: {label: 'الفرق', value: 25},
    unit: 'دقيقة', note: 'مثال توضيحي', claimFrame: 4, receiptFrame: 14, totalFrame: 54},
} as const;
