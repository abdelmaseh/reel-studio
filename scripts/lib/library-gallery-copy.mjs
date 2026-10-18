const reasons={missing:'محتاجين حركة جديدة للفكرة دي.','internal-only':'الأداة موجودة داخليًا ومحتاجة تجهيز للاستخدام.','not-reviewed':'الموجود محتاج مشاهدة وتقييم.','unsupported-in-context':'موجودة، لكن مش مناسبة لكل تقسيمات الشاشة.'};
const scopes={new:'حركة جديدة',wire:'تجهيز الموجود',review:'مراجعة الموجود'};
const rationales={
  'existing-motion-review':'نراجع اللي عندنا الأول عشان نعرف إيه شغال كويس وإيه محتاج ضبط قبل ما نزود حركات.',
  'conditional-branching':'لما الشرح فيه «لو حصل كذا نعمل كذا»، نحتاج مسارات واضحة ونشوف الاختيار وصل لإيه.',
  'identity-filtering':'نفس الكروت تعدّي على شروط؛ اللي ينفع يكمل واللي ماينفعش يخرج، والعين تفضل متابعاهم.',
  'queue-bottleneck':'يوضح فين الشغل بيتكدّس، وإيه اللي يحصل لما نفك المرحلة البطيئة.',
  'semantic-feedback':'النتيجة ترجع للمراجعة والتعديل، وبعدها نشوف نفس العنصر اتطور.',
  'editable-path-morph':'أداة تحوّل الرسومات موجودة؛ محتاجة تجهيزها كحركة لها إعدادات ومعاينة واضحة.',
  'concept-split-layout':'نختار تقسيمة مناسبة للشرح والمتحدث، ونراجع القراءة قبل تصغير مشهد كامل في جزء من الشاشة.',
};

/** Creator-facing wording is separate from the technical source-evidence report. */
export function galleryViewData(items,gapReport,inventory,editorialCatalog){
  const styles=new Map(inventory.items.filter(item=>item.kind==='style').map(item=>[item.nativeId,item.label?.ar??item.nativeId]));
  const guides=new Map((editorialCatalog?.items??[]).map(item=>[item.key,item.editorial]));
  const known=new Set(items.map(item=>item.key));
  const extra=(editorialCatalog?.items??[]).filter(item=>!known.has(item.key)).map(item=>({key:item.key,layer:item.layer,labelAr:item.editorial?.labelAr??item.label?.ar??item.nativeId,labelEn:item.label?.en??item.nativeId,style:item.kind==='style'?item.nativeId:item.ownerStyle,status:item.role==='extension-point'?'unsupported':'pending',notes:[]}));
  const moodLabels={calm:'هادي',energetic:'حماسي',editorial:'تحريري',serious:'جاد',playful:'خفيف',reflective:'متأمل',technical:'تقني',warm:'دافي'};
  const energyLabels={low:'إيقاع هادي',medium:'إيقاع متوسط',high:'إيقاع سريع'};
  const viewItems=[...items,...extra].map(item=>({...item,styleLabel:styles.get(item.style),
    scope:item.status==='unsupported'?'ده امتداد لمشهد خاص بكل مشروع، مش حركة جاهزة واحدة.':item.status==='pending'?'بطاقة اختيار للعنصر؛ المعاينة المتحركة لسه مش متاحة.':'معاينة توضيحية من نفس مكوّن الحركة الموجود في الاستوديو.',
    notes:item.status==='failed'?['تعذّر تجهيز المثال؛ التفاصيل مسجّلة في تقرير المراجعة.']:item.status==='unsupported'?['يتطلب حزمة مشاهد خاصة بالمشروع.']:
      item.scope?.includes('presenter')||item.key==='scene:creator-cta'||item.key==='scene:kinetic-hook'?['المساحة المخططة مكان فيديو المتحدث، مش تصوير لشخص.']:
      item.key==='scene:kinetic-text'||item.layer.includes('emphasis')||item.layer==='word-entrance'?['توقيت توضيحي للكلمات؛ فيديوك يستخدم الكلام المراجع من تسجيلك.']:['بيانات توضيحية، وليست نتائج حقيقية.']}))
    .map(item=>({...item,notes:[...item.notes,...(item.status==='rendered'&&item.posterSha256&&item.visualReview?.posterSha256===item.posterSha256&&Array.isArray(item.visualReview.notes)
      ?item.visualReview.notes.filter(note=>typeof note==='string').map(note=>`ملاحظة مراجعة: ${note}`):[])]}))
    .map(item=>{const guide=guides.get(item.canonicalKey??item.key);return {...item,selectionGuide:guide?.assessment==='current'?{...guide.display,fit:[...guide.moods.map(value=>moodLabels[value]??value),...guide.energy.map(value=>energyLabels[value]??value)].join(' · ')}:undefined,
      notes:guide?.assessment==='stale'?[...item.notes,'بطاقة الاختيار محتاجة مراجعة بعد تغيير مكوّن الحركة.']:item.notes};});
  const viewGaps={...gapReport,summary:'الترتيب ده توصية حسب الفايدة المتوقعة وسهولة البناء. كل إضافة لسه محتاجة نموذج ومراجعة.',
    limitations:['التقييم مبني على الكود اللي اتفهرس؛ المشاهد الخاصة بكل مشروع ممكن توسّع الإمكانيات.',
      'الأولوية تقديرية، وليست إحصائيات استخدام أو مدة تنفيذ مقاسة.',
      'وجود المعاينة لا يعني موافقتك على شكلها في فيديوك.',
      'قراءة العربي والتوقيت والهوية بيتراجعوا في سياق كل فيديو.',
      'الستايل والمشهد والحركة أنواع مختلفة، وأعدادها لا تُجمع في رقم واحد.'],
    gaps:gapReport.gaps.map(gap=>({...gap,rationale:rationales[gap.id]??gap.rationale,scope:scopes[gap.scope]??gap.scope,reason:reasons[gap.reason]??gap.reason}))};
  return {items:viewItems,gapReport:viewGaps};
}
