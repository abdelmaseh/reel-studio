// These scores are illustrative placeholders, never measurements or library claims.
export const magazineTemplateData = {
  verdict:{question:'مثال: الأداة دي تستاهل؟',rows:[
    {label:'السهولة',value:8,outOf:10,atFrame:30},
    {label:'السعر',value:6,outOf:10,atFrame:46},
    {label:'النتيجة',value:9,outOf:10,atFrame:62},
  ],verdict:'مثال: يستاهل',verdictFrame:84},
} as const;
export const MAGAZINE_COPY_KEYS:ReadonlySet<string> = new Set(['question','label','verdict']);
