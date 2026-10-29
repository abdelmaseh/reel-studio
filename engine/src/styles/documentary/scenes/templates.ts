// Clearly illustrative editor placeholders; delivery must replace copy and supply the named image.
export const documentaryTemplateData = {
  'map-route': {title:'مثال توضيحي',caption:'اكتب معنى المسار هنا',borders:false,places:[{name:'مكان البداية',lon:0,lat:0},{name:'مكان الوصول',lon:16,lat:9}],drawAt:15,drawDuration:75},
  'map-focus': {title:'مثال توضيحي',caption:'اكتب وصف المكان هنا',borders:false,target:{name:'اسم المكان',lon:0,lat:0},zoom:2,focusAt:15,focusDuration:60},
  'cutout-card': {title:'مثال توضيحي',caption:'اكتب شرح الصورة هنا',image:{src:'library-preview/diagram-a.svg',sha256:'4db2569989a5c4529615ffaa7138d4c45b9b4392a794b657d0a825cf099bd512',width:1920,height:1080,kind:'image'},at:10,fit:'contain',tilt:-2},
} as const;
export const DOCUMENTARY_COPY_KEYS:ReadonlySet<string>=new Set(['title','caption','name','country','credit','src']);
