import type { Issue } from "../types.ts";

const TIMING_LABEL: Record<string, string> = {
  swap: "لحظة الـ swap",
  stamp: "لحظة الـ stamp",
  activation: "توقيت ظهور عنصر",
  count: "بداية الـ count",
  "count end": "نهاية الـ count",
  unit: "لحظة الـ unit",
  badge: "لحظة الـ badge",
};

const RULES: [RegExp, (m: RegExpExecArray) => string][] = [

  [/^(.+?): (swap|stamp|activation|count|count end|unit|badge) must land inside its scene$/, (m) => `المشهد "${m[1]}": ${TIMING_LABEL[m[2]] ?? m[2]} لازم يقع جوّه مدة المشهد.`],
  [/^(.+?): activations must be (strictly )?ordered$/, (m) => `المشهد "${m[1]}": توقيتات الظهور لازم تكون مترتبة${m[2] ? " وكل واحد بعد اللي قبله" : ""}.`],
  [/^(.+?): foreground does not cover the scene$/, (m) => `المشهد "${m[1]}": ملف الـ foreground أقصر من مدة المشهد.`],
  [/^(.+?): first screen must start at zero$/, (m) => `المشهد "${m[1]}": أول شاشة لازم تبدأ عند فريم 0.`],

  [/^(.+?): focus steps must start at zero/, (m) => `المشهد "${m[1]}": خطوات الـ focus لازم تبدأ من صفر، مترتبة، وتخلص قبل اللي بعدها.`],
  [/^(.+?): data reveals must be ordered/, (m) => `المشهد "${m[1]}": ظهور الأرقام لازم يكون مترتب ويخلص قبل نهاية المشهد.`],
  [/^(.+?): metric display needs exactly one/, (m) => `المشهد "${m[1]}": عرض الـ metric محتاج رقم واحد بالظبط.`],
  [/^(.+?): bar comparisons need at least two/, (m) => `المشهد "${m[1]}": مقارنة الـ bars محتاجة رقمين على الأقل.`],
  [/^(.+?): bar comparisons need a takeover/, (m) => `المشهد "${m[1]}": مقارنة الـ bars لازم تبقى takeover.`],

  [/dir applies only to whip-pan/, () => "الاتجاه (dir) بيشتغل بس مع whip-pan و clip-wipe و light-scan."],
  [/^(\S+) at (\d+) must start on a scene's first frame/, (m) => `الـ ${m[1]} لازم يبدأ عند أول فريم في مشهد (فريم ${m[2]} مش بداية مشهد).`],
  [/^(\S+) at (\d+) is longer than scene (.+)\.$/, (m) => `الـ ${m[1]} أطول من المشهد "${m[3]}".`],
  [/^(\S+) cannot run on presenter scene (.+?):/, (m) => `الـ ${m[1]} مينفعش على مشهد presenter ("${m[2]}") عشان مبيتحركش حاجة فوق وشه.`],
  [/^whip-pan at (\d+) would decode scene (.+?)'s video/, (m) => `الـ whip-pan على المشهد "${m[2]}" هيبوّظ الفيديو اللي جواه. استخدم clip-wipe أو light-scan.`],
  [/^whip-pan at (\d+) on split scene (.+?) may only/, (m) => `الـ whip-pan على مشهد split ("${m[2]}") لازم يبقى rtl أو ltr بس.`],
  [/^hue-crossfade at (\d+) needs a chapter/, (m) => `الـ hue-crossfade عند ${m[1]} محتاج chapter على المشهد وعلى اللي قبله.`],
  [/^Scene (.+?) has (\d+) graphics entrances/, (m) => `المشهد "${m[1]}" عليه ${m[2]} entrances. المسموح واحد بس.`],
  [/^Scene (.+?) has (\d+) hue crossfades/, (m) => `المشهد "${m[1]}" عليه ${m[2]} hue-crossfade. المسموح واحد بس.`],

  [/^Layout transition at (\d+): from and to must differ/, (m) => `الـ layout transition عند ${m[1]}: الـ from والـ to لازم يختلفوا.`],
  [/^Layout transition at (\d+): a curtain descends/, (m) => `الـ layout transition عند ${m[1]}: الـ curtain بينزل من presenter لـ split بس. استخدم window-morph للباقي.`],
  [/^Layout transition at (\d+): a curtain needs both footage windows/, (m) => `الـ layout transition عند ${m[1]}: الـ curtain محتاج شباك الفوتيج الاتنين يوصلوا لآخر الفريم.`],
  [/^Layout transition at (\d+): needs one earlier frame/, (m) => `الـ layout transition عند ${m[1]}: لازم يبقى قبله فريم واحد على الأقل.`],
  [/^Layout transition at (\d+): layout transitions must be ordered/, (m) => `الـ layout transition عند ${m[1]}: مترتبين ومن غير تداخل.`],
  [/^Layout transition at (\d+): must end before/, (m) => `الـ layout transition عند ${m[1]}: لازم يخلص قبل الـ signoff ونهاية الفيديو.`],
  [/^Layout transition at (\d+): the frame before it must be in the (\w+) layout/, (m) => `الـ layout transition عند ${m[1]}: الفريم اللي قبله لازم يكون layout ${m[2]}.`],
  [/^Layout transition at (\d+): frame (\d+) is not in the (\w+) layout/, (m) => `الـ layout transition عند ${m[1]}: فريم ${m[2]} مش في layout ${m[3]}.`],
  [/^Layout transition at (\d+): the first frame after it must be in the (\w+) layout/, (m) => `الـ layout transition عند ${m[1]}: أول فريم بعده لازم يكون layout ${m[2]}.`],

  [/^Caption emphasis names word (\d+)/, (m) => `الـ emphasis بيشاور على كلمة #${Number(m[1]) + 1} مش موجودة.`],
  [/^Caption emphasis must be strictly ordered/, () => "الـ emphasis لازم يبقى مترتب بالكلمات، ونوع واحد لكل كلمة."],
  [/^Caption emphasis 'pop' animates a word; the (.+?) DNA/, (m) => `الـ pop مش مسموح في ستايل ${m[1]}: الكابشن فيه ثابت.`],

  [/^PiP scene (.+?) does not exist/, (m) => `الـ PiP بيشاور على مشهد "${m[1]}" مش موجود.`],
  [/^PiP scene (.+?) must be a takeover/, (m) => `الـ PiP على مشهد "${m[1]}" لازم يبقى takeover.`],
  [/^Chapter palette fails contrast/, () => "ألوان الـ chapter مش واضحة كفاية (contrast ضعيف)."],

  // B-roll rules (engine/src/prepared-edit/broll.ts and the screens schema), in neutral Arabic like BROLL_TEXT. They keep the scene id and the numbers.
  [/^(.+?): B-roll is not available in the (.+?) style, which draws its own screen\.$/, (m) => `المشهد "${m[1]}": لقطات B-roll غير متاحة في ستايل ${m[2]} لأنه يرسم الشاشة بنفسه. اختر ستايلًا آخر أو احذف المشهد.`],
  [/^(.+?): B-roll must end before the recorded sign-off\.$/, (m) => `المشهد "${m[1]}": يجب أن ينتهي مشهد B-roll قبل «التوقيع» المسجّل في آخر الفيديو. قصّر المشهد أو انقله إلى موضع أبكر.`],
  [/^(.+?): B-roll cannot sit on or after the ending scenes\.$/, (m) => `المشهد "${m[1]}": لا يجوز أن يقع مشهد B-roll على مشاهد الختام أو بعدها. ضعه قبلها.`],
  [/^(.+?): a split B-roll scene needs the presenter on screen; use the full-screen layout\.$/, (m) => `المشهد "${m[1]}": مشهد B-roll بنصف الشاشة يحتاج إلى ظهور المتحدث على الشاشة. اجعل المشهد بملء الشاشة.`],
  [/^(.+?) step (\d+): the clip would be enlarged ([\d.]+)x in its (\d+)x(\d+) box \(limit ([\d.]+)x\); use (.+)\.$/, (m) => {
    const advice = [/the split layout/.test(m[7]) ? "اجعل المشهد بنصف الشاشة" : null, /fit "contain"/.test(m[7]) ? "اختر وضع contain" : null, "استخدم لقطة بدقة أعلى"].filter((x): x is string => x !== null);
    const last = advice.pop();
    return `المشهد "${m[1]}" (اللقطة ${m[2]}): ستُكبَّر اللقطة ${m[3]} مرة داخل مساحة ${m[4]}×${m[5]} والحد الأقصى ${m[6]} مرة، فتفقد وضوحها. ${advice.length ? `${advice.join("، ")} أو ${last}` : last}.`;
  }],
  [/^(.+?): a B-roll scene shown with the presenter window cannot carry a label,/, (m) => `المشهد "${m[1]}": نافذة المتحدث الصغيرة تغطي ركن التسمية، فلا يجوز أن يحمل مشهد B-roll تسمية وهو يظهر معها. احذف التسمية أو أخرج المشهد من مشاهد نافذة المتحدث.`],
  [/^Only the B-roll look of screens supports the split layout/, () => "نصف الشاشة متاح لشكل B-roll وحده من مشهد الشاشات. اجعل المشهد بملء الشاشة أو بدّل شكله إلى B-roll."],
];


export function explainEnglish(english: string): string | null {
  for (const [rx, fn] of RULES) {
    const hit = rx.exec(english);
    if (hit) return fn(hit);
  }
  return null;
}

const GENERIC = "مشكلة في الـ manifest:";


export function explainIssue(issue: Issue): string {
  let message = issue.message;
  if (issue.detail && (message.startsWith(GENERIC) || issue.code === "zod:custom")) message = explainEnglish(issue.detail) ?? message;
  const where = issue.where && issue.where !== "الـ manifest" ? `${issue.where}: ` : "";
  return `${where}${message}`;
}


export function issuesReason(issues: Issue[], max = 3): string {
  const lines: string[] = [];
  for (const i of issues) {
    if (i.severity !== "error") continue;
    const line = explainIssue(i);
    if (!lines.includes(line)) lines.push(line);
    if (lines.length >= max) break;
  }
  return lines.join(" · ") || "التعديل ده هيخلّي الـ manifest غير صالح.";
}
