// One Arabic scene per family, with every number field filled and Latin digits inside the text. The scenes are valid
// edit scenes (editSceneSchema parses each one), so a render of them shows what a creator's Arabic video shows.
const scene = (family, layout, data, durationInFrames = 240) => ({id: family, family, layout, motion: 'land', fromFrame: 0, durationInFrames, data: structuredClone(data)});

export const ARABIC_KEYWORD = 'قالب';

export const ARABIC_SCENES = Object.freeze([
  scene('intro', 'takeover', {kicker: 'خطوة 1 من 3', title: 'فكرة واضحة', subtitle: 'اشرح فكرتك في 3 جمل', caption: 'تعليق 2024'}),
  scene('proof', 'takeover', {label: 'عدد المتابعين', value: 12500, suffix: '%', source: 'المصدر 2024', caption: 'رقم حقيقي', valueFit: 'final'}),
  scene('process', 'takeover', {title: 'ثلاث خطوات', steps: [
    {title: 'اختر', detail: 'الخطوة 1'}, {title: 'عدّل', detail: 'الخطوة 2'}, {title: 'راجع', detail: 'الخطوة 3'}], caption: 'بسيط'}),
  scene('comparison', 'takeover', {title: 'الفرق واضح', beforeTitle: 'قبل', beforeDetail: 'كنا 5 أشخاص', afterTitle: 'بعد', afterDetail: 'صرنا 50 شخصًا', caption: 'فرق'}),
  scene('comment', 'takeover', {keyword: ARABIC_KEYWORD, promise: 'القالب مجانًا خلال 24 ساعة', caption: 'اكتب القالب'}),
  scene('follow', 'takeover', {handle: '@your.handle', message: 'أفكار عملية كل أسبوع 7', caption: 'تابعني'}),
  scene('checklist', 'takeover', {kicker: 'قائمة 4 نقاط', title: 'راجع قبل النشر', variant: 'missing', items: [
    {label: 'العنوان', detail: 'تم 1', atFrame: 10}, {label: 'الصورة', detail: 'تم 2', atFrame: 30}, {label: 'الوصف', detail: 'تم 3', atFrame: 50}]}),
  scene('count', 'split', {kicker: 'الرقم 1', title: 'رقم حقيقي', value: 12500, suffix: '%', unit: 'من العينة', rollFrame: 10, rollDuration: 30, unitFrame: 50, badge: 'مصدر 2024', badgeFrame: 60, valueFit: 'final'}),
  scene('screens', 'takeover', {kicker: 'الشاشات', steps: [
    {atFrame: 0, title: 'الشاشة الأولى', src: 'examples/evidence-before.svg', kind: 'image', fit: 'contain', trimBeforeFrame: 0},
    {atFrame: 80, title: 'الشاشة الثانية', src: 'examples/evidence-after.svg', kind: 'image', fit: 'contain', trimBeforeFrame: 0}]}),
  scene('statement', 'presenter', {kicker: 'النقطة 5', title: 'جملة واحدة تهم'}),
  scene('outcome', 'split', {kicker: 'النتيجة', title: 'ماذا تحصل', items: ['نتيجة 1', 'نتيجة 2', 'نتيجة 3'], footer: 'من المبدع 2024'}),
  scene('creator-cta', 'presenter', {title: 'تريد الدليل كاملًا؟', keyword: ARABIC_KEYWORD, prompt: 'اكتب {keyword} وسأرسل لك 3 نصائح', handle: '@example.handle', followFrame: 40, clickedFrame: 70}),
  scene('chapter-quote', 'takeover', {chapter: '01', title: 'سؤال للاستكشاف', quote: 'اقتباس من المتحدث في 2024', speaker: 'اسم المتحدث', role: 'المنصب', quoteFrame: 20}),
  scene('meter-receipt', 'takeover', {kicker: 'القياس', title: 'قارن الوحدة نفسها', rows: [{label: 'الخيار 1', value: 25.5, atFrame: 8}, {label: 'الخيار 2', value: 60, atFrame: 28}], maximum: 100, unit: 'وحدة', source: 'قيم توضيحية 2024'}),
  scene('route-stops', 'takeover', {kicker: 'المسار', title: 'خطواتك التالية', stops: [{label: 'البداية', detail: 'اختر السؤال 1', atFrame: 8}, {label: 'الاستكشاف', detail: 'قارن 2', atFrame: 30}, {label: 'المراجعة', detail: 'افحص 3', atFrame: 52}], footer: 'الخلاصة 2024'}),
  scene('comment-stack', 'takeover', {kicker: 'نقاش', title: 'أسئلة تستحق الإجابة', comments: [{author: 'متابع 1', text: 'سؤال حقيقي رقم 1', atFrame: 10}, {author: 'متابع 2', text: 'سؤال آخر رقم 2', atFrame: 30}], keyword: ARABIC_KEYWORD, prompt: 'اكتب الكلمة'}),
  scene('ticket-offer', 'takeover', {kicker: 'دعوة', title: 'جلستك التالية', ticket: {label: 'جلسة 1', value: 'جلسة واحدة 30 دقيقة', detail: 'العرض الحقيقي 2024', atFrame: 12}, footer: 'الشروط 2024'}),
  scene('token-lens', 'takeover', {kicker: 'التجميع', title: 'فكرة وعدة أجزاء', groups: [{label: 'مجموعة 1', tokens: ['فكرة', 'واضحة'], atFrame: 6}, {label: 'مجموعة 2', tokens: ['خطوات', '3'], atFrame: 24}], lens: {groupIndex: 1, tokenIndex: 1, atFrame: 40}, footer: 'شرحك 2024'}),
  scene('data-story', 'takeover', {kicker: 'البيانات', title: 'رقم من مصدر', sourceNote: 'المصدر 2024', display: 'metric', suffix: '%', unit: 'نسبة', animateFrames: 30, items: [{label: 'القيمة', value: 42.5, atFrame: 10}]}),
  Object.assign(scene('data-story', 'takeover', {kicker: 'البيانات', title: 'مقارنة بالأعمدة', sourceNote: 'المصدر 2024', display: 'bars', suffix: '', unit: 'وحدة', animateFrames: 30, items: [{label: 'أ', value: 10, atFrame: 10}, {label: 'ب', value: 20.5, atFrame: 20}]}), {id: 'data-story-bars'}),
  scene('screen-focus', 'takeover', {kicker: 'الشاشة', steps: [{atFrame: 0, focusFrame: 10, settleFrames: 20, title: 'الخطوة الأولى', label: 'اضغط هنا 1', src: 'examples/evidence-before.svg', sourceWidth: 640, sourceHeight: 360, focus: {x: 0.1, y: 0.1, width: 0.5, height: 0.5}, zoom: 1.5}]}),
  // Families that draw labels without the shared text fitter, so the audit also reaches them.
  scene('kinetic-hook', 'presenter', {label: 'نصيحة 1', firstTitle: 'خطأ شائع 1', secondTitle: 'الحل في 3 خطوات', swapFrame: 60, stamp: 'جرّب 2024', stampFrame: 90}),
  scene('image-compare', 'takeover', {kicker: 'مقارنة 1', title: 'قبل وبعد 2024', images: [{src: 'examples/evidence-before.svg', label: 'قبل 2020'}, {src: 'examples/evidence-after.svg', label: 'بعد 2024'}], stamp: 'فرق 50%'}),
  scene('evidence-wipe', 'takeover', {kicker: 'دليل 1', title: 'قارن الصورتين', before: {src: 'examples/evidence-before.svg', width: 640, height: 360, label: 'قبل 2020'}, after: {src: 'examples/evidence-after.svg', width: 640, height: 360, label: 'بعد 2024'}, revealFrame: 12, revealDurationFrames: 30, dir: 'rtl', footer: 'المصدر 2024'}),
  scene('message-board', 'takeover', {initialTitle: 'رسائل كثيرة 5', boardTitle: 'لوحة واحدة 1', focusTitle: 'نتيجة واحدة 2024', closingTitle: 'خطوتك 3', items: [{id: 'question', label: 'سؤالك 1', detail: 'تفصيل 2'}, {id: 'step', label: 'خطوتك 2'}, {id: 'result', label: 'نتيجتك 3', detail: 'تفصيل 3'}], focusIndex: 2, gatherFrame: 30, gatherDurationFrames: 30, focusFrame: 90, focusDurationFrames: 30}),
]);

/** The families of ARABIC_SCENES, in order. */
export const ARABIC_FAMILIES = Object.freeze(ARABIC_SCENES.map((item) => item.family));
