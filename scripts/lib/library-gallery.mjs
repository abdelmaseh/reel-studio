const STATUS = {
  rendered: {label: 'Preview متاح', detail: 'شغّل الفيديو عشان تشوف الحركة.'},
  pending: {label: 'لسه ما اتعملش', detail: 'مفيش فيديو للعرض لحد دلوقتي.'},
  failed: {label: 'الـ Preview فشل', detail: 'مفيش فيديو للعرض. المحاولة محتاجة مراجعة.'},
  unsupported: {label: 'من غير Preview هنا', detail: 'مفيش فيديو للعرض بالطريقة الحالية.'},
};

const LAYERS = {
  concept: 'مشهد كامل', 'motion-concept': 'مشهد كامل', scene: 'مشهد',
  overlay: 'إضافة فوق الصورة', effect: 'تأثير', transition: 'انتقال',
  punch: 'حركة كاميرا', entrance: 'دخول عنصر', style: 'ستايل',
  'camera-punch': 'حركة كاميرا', 'text-entrance': 'دخول نص',
  camera:'حركة كاميرا','graphics-transition':'انتقال جرافيكس','layout-transition':'تقسيمة الشاشة',
  'word-entrance':'دخول الكلمات','scene-entrance':'دخول العناصر','caption-emphasis':'تأكيد الكابشن',
  'kinetic-emphasis':'تأكيد الكلام الحركي','recipe-variant':'نسخة من مشهد',
};

function text(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/(?:[a-z]:[\\/]|\\\\|file:\/\/)[^\r\n]*/gi, '[مسار محلي مخفي]')
    .replace(/(^|[\s(])\/[a-z0-9._-][^\r\n]*/gi, '$1[مسار محلي مخفي]');
}

function escape(value) {
  return text(value).replace(/[&<>"']/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

function relativeMediaPath(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._/-]*$/i.test(value)
    || value.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new TypeError('Expected a safe relative media path inside the gallery directory.');
  }
  return value;
}

function normalizeItem(item) {
  if (!item || typeof item.key !== 'string' || !item.key.trim()) throw new TypeError('Gallery items require a non-empty key.');
  if (!Object.hasOwn(STATUS, item.status)) throw new TypeError('Unknown gallery item status.');
  const video = relativeMediaPath(item.video);
  const poster = relativeMediaPath(item.poster);
  const status = item.status === 'rendered' && !video ? 'pending' : item.status;
  return {...item, video, poster, status, layer: text(item.layer || 'other'), notes: Array.isArray(item.notes) ? item.notes : []};
}

function renderCard(item) {
  const status = STATUS[item.status];
  const label = item.labelAr || item.labelEn || item.key;
  const search = [item.key, label, item.labelEn, item.layer, item.style, ...item.notes,...Object.values(item.selectionGuide??{})].map(text).join(' ').toLocaleLowerCase();
  const preview = item.status === 'rendered'
    ? `<video controls playsinline preload="none" src="${escape(item.video)}"${item.poster ? ` poster="${escape(item.poster)}"` : ''} aria-label="${escape(`معاينة ${text(label)}`)}">المتصفح مش قادر يشغّل الفيديو.</video>`
    : `<div class="preview-placeholder"><span class="placeholder-mark" aria-hidden="true">◇</span><span>${escape(status.label)}</span><small>${escape(status.detail)}</small></div>`;
  const notes = item.notes.map((note) => text(note)).filter(Boolean);
  return `<article class="motion-card" data-layer="${escape(item.layer)}" data-status="${item.status}" data-search="${escape(search)}">
    <div class="preview">${preview}<span class="status-badge ${item.status}">${escape(status.label)}</span></div>
    <div class="card-copy"><div class="card-meta"><span>${escape(LAYERS[item.layer] || item.layer)}</span>${Number.isFinite(item.durationSec) && item.durationSec > 0 ? `<span>${escape(Number(item.durationSec.toFixed(2)))} ث</span>` : ''}${Number.isInteger(item.renderInfo?.width)&&Number.isInteger(item.renderInfo?.height)?`<span dir="ltr">${escape(item.renderInfo.width)}×${escape(item.renderInfo.height)}</span>`:''}</div>
    <h3>${escape(label)}</h3>${item.labelEn ? `<p class="english" dir="ltr">${escape(item.labelEn)}</p>` : ''}
    <code dir="ltr">${escape(item.key)}</code>
    ${item.style ? `<p class="style">الستايل: <bdi>${escape(item.styleLabel||item.style)}</bdi></p>` : ''}
    ${item.scope ? `<p class="scope">${escape(item.scope)}</p>` : ''}
    ${item.selectionGuide?`<dl class="selection-guide"><dt>بتوضح</dt><dd>${escape(item.selectionGuide.explains)}</dd><dt>استخدمها لما</dt><dd>${escape(item.selectionGuide.useWhen)}</dd><dt>خلي بالك</dt><dd>${escape(item.selectionGuide.avoidWhen)}</dd></dl><p class="selection-fit">إحساس مقترح: ${escape(item.selectionGuide.fit)}</p>`:''}
    ${notes.length ? `<ul class="notes">${notes.map((note) => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}</div>
  </article>`;
}

function getGaps(gapReport) {
  if (Array.isArray(gapReport)) return gapReport;
  return [gapReport?.items, gapReport?.rankedGaps, gapReport?.gaps].find(Array.isArray) || [];
}

function renderGapPanel(gapReport) {
  const gaps = getGaps(gapReport);
  const limitations = Array.isArray(gapReport?.limitations) ? gapReport.limitations : [];
  return `<aside class="gap-panel" aria-labelledby="gaps-title"><div class="panel-kicker">تطوير المكتبة</div><h2 id="gaps-title">إيه اللي ناقصنا؟</h2>
    <p class="panel-intro">${escape(typeof gapReport?.summary==='string'?gapReport.summary:'ترتيب مقترح للإضافات الجاية، حسب فايدتها واستخدامها. دي اقتراحات لسه ما اتنفّذتش.')}</p>
    ${gaps.length ? `<ol class="gap-list">${gaps.map((gap, index) => `<li><div class="gap-top"><span class="rank">${escape(gap.rank || index + 1)}</span><span class="priority">${escape(({high: 'أولوية عالية', medium: 'أولوية متوسطة', low: 'أولوية أقل', immediate: 'أولوية عالية', next: 'أولوية متوسطة', later: 'أولوية أقل'})[gap.priorityBand] || 'اقتراح')}</span></div>
      <h3>${escape(gap.labelAr || gap.title || gap.labelEn || gap.key || 'إضافة مقترحة')}</h3>
      ${gap.key ? `<code dir="ltr">${escape(gap.key)}</code>` : ''}
      ${gap.rationale ? `<p>${escape(gap.rationale)}</p>` : ''}
      ${gap.reason && gap.reason !== gap.rationale ? `<p>${escape(gap.reason)}</p>` : ''}
      ${gap.scope ? `<p class="gap-scope"><strong>النطاق:</strong> ${escape(gap.scope)}</p>` : ''}</li>`).join('')}</ol>` : '<p class="scope">مفيش ترتيب نواقص مرفق بالمعرض ده.</p>'}
    ${limitations.length ? `<div class="gap-limitations"><strong>حدود التقييم</strong><ul>${limitations.map((limit) => `<li>${escape(limit)}</li>`).join('')}</ul></div>` : ''}
  </aside>`;
}

const CSS = `
:root{color-scheme:dark;--bg:#111715;--panel:#19211e;--ink:#f4efe2;--muted:#a7b2ab;--line:#324039;--cyan:#9ce4d8;--amber:#e8c58a;--red:#eca699}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--cyan)}button,input,select{font:inherit}main{width:min(1560px,94%);margin:auto;padding:36px 0 60px}.brand{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:12px;letter-spacing:.12em;text-transform:uppercase}.brand-mark{width:26px;height:26px;border:1px solid var(--cyan);border-radius:7px;transform:rotate(-12deg);display:inline-block;background:linear-gradient(135deg,transparent 40%,#9ce4d82b 40%)}header{padding:0 0 28px;border-bottom:1px solid var(--line)}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-top:24px}h1{font-size:clamp(30px,3.2vw,48px);font-weight:650;line-height:1.35;margin:0 0 14px;letter-spacing:-.025em}.intro{margin:0;max-width:740px;color:var(--muted);font-size:16px}.stats{display:flex;gap:26px;flex-shrink:0}.stat strong{display:block;font-size:30px;line-height:1.1;font-weight:550;color:var(--cyan)}.stat span{font-size:12px;color:var(--muted)}.review-note{padding:12px 16px;border-inline-start:3px solid var(--cyan);background:#9ce4d809;font-size:13px;color:var(--muted);margin:24px 0 0}.review-note strong{color:var(--ink);font-weight:500}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:28px;margin-top:28px;align-items:start}.library{min-width:0}.filters{display:grid;grid-template-columns:minmax(180px,1.7fr) 1fr 1fr;gap:12px;position:sticky;top:0;background:var(--bg);z-index:5;padding:12px 0 14px}.filters label{display:block;font-size:12px;color:var(--muted)}input,select{display:block;width:100%;height:44px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);padding:8px 12px;margin-top:5px;min-width:0}input:focus,select:focus{outline:2px solid var(--cyan);outline-offset:2px}input::placeholder{color:#7c8a82}.results-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin:9px 0 18px}.results-row h2{font-size:18px;font-weight:550;margin:0}.results-row p{font-size:12px;color:var(--muted);margin:0}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px}.motion-card{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.preview{position:relative;background:#0a100d;border-bottom:1px solid var(--line);aspect-ratio:9/13;display:grid;place-items:center}.preview video{width:100%;height:100%;display:block;position:absolute;inset:0;object-fit:contain}.status-badge{position:absolute;top:12px;right:12px;font-size:10px;padding:3px 9px;border:1px solid #67797080;border-radius:20px;background:#111715ed;color:var(--muted);pointer-events:none}.status-badge.rendered{color:var(--cyan);border-color:#9ce4d84d}.status-badge.failed{color:var(--red);border-color:#eca6994d}.status-badge.unsupported{color:var(--amber);border-color:#e8c58a4d}.preview-placeholder{display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;max-width:88%;gap:9px;color:var(--muted)}.placeholder-mark{font-size:64px;line-height:1.4;color:#53655a}.preview-placeholder>span:not(.placeholder-mark){font-size:14px}.preview-placeholder small{font-size:11px;max-width:200px;color:#7f9085}.card-copy{padding:16px}.card-meta{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}h3{margin:7px 0 3px;font-size:18px;line-height:1.5;font-weight:600;overflow-wrap:anywhere}.english{font-size:11px;color:var(--muted);text-align:right;margin:0 0 12px}code{display:block;overflow-wrap:anywhere;text-align:left;font:11px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--cyan)}.style{margin:12px 0 0;font-size:11px;color:var(--muted)}.scope{font-size:12px;color:var(--muted);margin:12px 0 0}.notes{padding-inline-start:18px;color:var(--amber);font-size:11px;margin:12px 0 0}.gap-panel{border:1px solid var(--line);border-radius:12px;padding:22px;background:#1b231e}.panel-kicker{font-size:10px;color:var(--cyan);letter-spacing:.08em}h2{margin:5px 0 10px;font-size:24px;font-weight:600}.panel-intro{font-size:12px;color:var(--muted);margin:0 0 18px}.gap-list{list-style:none;margin:0;padding:0}.gap-list>li{border-top:1px solid var(--line);padding:18px 0}.gap-list>li:last-child{padding-bottom:0}.gap-top{display:flex;justify-content:space-between;align-items:center}.rank{width:27px;height:27px;border:1px solid #9ce4d84d;border-radius:50%;font-size:12px;color:var(--cyan);text-align:center;line-height:25px}.priority{font-size:10px;color:var(--amber)}.gap-list h3{font-size:16px;margin-top:10px}.gap-list p{font-size:12px;margin:10px 0 0;color:var(--muted)}.gap-list .gap-scope{font-size:11px;border-inline-start:2px solid var(--line);padding-inline-start:10px}.gap-scope strong{font-weight:500;color:var(--ink)}.gap-limitations{border-top:1px solid var(--line);margin-top:22px;padding-top:16px;font-size:11px;color:var(--muted)}.gap-limitations strong{font-weight:500;color:var(--ink)}.gap-limitations ul{padding-inline-start:17px;margin:8px 0 0}.empty{border:1px dashed var(--line);border-radius:12px;text-align:center;padding:50px 16px;color:var(--muted);margin-top:16px}.empty strong{display:block;color:var(--ink);font-weight:500}.empty p{margin:8px 0 0;font-size:13px}footer{margin-top:32px;color:var(--muted);font-size:11px;text-align:center}[hidden]{display:none!important}@media(min-width:1400px){.cards{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:1000px){.layout{grid-template-columns:minmax(0,1fr) 260px;gap:18px}.hero{align-items:start}.stats{gap:16px}.filters{grid-template-columns:1fr 1fr}.filters label:first-child{grid-column:1/-1}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.gap-panel{padding:18px}}@media(max-width:720px){main{width:92%;padding-top:24px}.hero{display:block}.stats{margin-top:24px;gap:30px}.stat strong{font-size:26px}.layout{grid-template-columns:1fr}.gap-panel{margin-top:8px}.filters{top:0}.cards{gap:12px}.card-copy{padding:12px}h3{font-size:16px}.preview{aspect-ratio:9/14}.status-badge{top:8px;right:8px;font-size:9px}.review-note{font-size:12px}}@media(max-width:390px){.cards{grid-template-columns:1fr}.preview{aspect-ratio:9/12}}@media(prefers-reduced-motion:no-preference){.motion-card{transition:border-color .16s ease}.motion-card:hover{border-color:#6c8b79}}
`;

const GUIDE_CSS='.selection-guide{border-top:1px solid var(--line);margin:16px 0 0;padding-top:12px;font-size:12px}.selection-guide dt{font-weight:600;color:var(--cyan);margin-top:10px}.selection-guide dd{margin:3px 0 0;color:var(--ink)}.selection-fit{font-size:10px;color:var(--muted);margin:12px 0 0}';

const FILTER_SCRIPT = `
(() => {
  const cards = [...document.querySelectorAll('.motion-card')];
  const search = document.getElementById('search');
  const layer = document.getElementById('layer');
  const status = document.getElementById('status');
  const count = document.getElementById('result-count');
  const empty = document.getElementById('empty');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/[\\u064b-\\u065f\\u0670\\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
  function filter() {
    const query = normalize(search.value.trim());
    let visible = 0;
    for (const card of cards) {
      const matches = (!query || normalize(card.dataset.search).includes(query))
        && (layer.value === 'all' || card.dataset.layer === layer.value)
        && (status.value === 'all' || card.dataset.status === status.value);
      card.hidden = !matches;
      if (matches) visible += 1;
      else card.querySelector?.('video')?.pause();
    }
    count.textContent = visible + ' من ' + cards.length + ' عنصر';
    empty.hidden = visible !== 0;
  }
  search.addEventListener('input', filter);
  layer.addEventListener('change', filter);
  status.addEventListener('change', filter);
  filter();
})();
`;

/** Render a self-contained, read-only gallery. Media URLs must be gallery-relative. */
export function renderLibraryGallery({items = [], gapReport, title = 'مكتبة الحركة — Reel Studio'} = {}) {
  if (!Array.isArray(items)) throw new TypeError('Gallery items must be an array.');
  const normalized = items.map(normalizeItem);
  const available = normalized.filter((item) => item.status === 'rendered').length;
  const layers = [...new Set(normalized.map((item) => item.layer))];
  const statusOptions = Object.entries(STATUS).map(([key, status]) => `<option value="${key}">${escape(status.label)}</option>`).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(title)}</title><style>${CSS}${GUIDE_CSS}</style></head>
<body><main><header><div class="brand"><span class="brand-mark" aria-hidden="true"></span><span dir="ltr">Reel Studio / Motion Library</span></div>
<div class="hero"><div><h1>${escape(title)}</h1><p class="intro">شوف الحركة، افهم بتعمل إيه، واختار اللي يخدم الفكرة. كل كارت بيبيّن نوع العنصر وحدود المعاينة.</p></div><div class="stats" aria-label="ملخص المكتبة"><div class="stat"><strong>${normalized.length}</strong><span>عنصر في المعرض</span></div><div class="stat"><strong>${available}</strong><span>Preview متاح</span></div></div></div>
<p class="review-note"><strong>الـ Preview مثال على التنفيذ.</strong> وجوده هنا مش موافقة منك على الشكل النهائي؛ كل فيديو محتاج مراجعتك الإبداعية.</p><nav aria-label="أقسام المعرض" style="display:flex;gap:24px;margin-top:18px"><a href="#library-title">المعاينات</a><a href="#gaps-title">أولويات التوسّع</a></nav></header>
<div class="layout"><section class="library" aria-labelledby="library-title"><div class="filters"><label for="search">دوّر على حركة<input id="search" type="search" autocomplete="off" placeholder="الاسم بالعربي أو English أو الـ key"></label><label for="layer">نوع العنصر<select id="layer"><option value="all">كل الأنواع</option>${layers.map((layer) => `<option value="${escape(layer)}">${escape(LAYERS[layer] || layer)}</option>`).join('')}</select></label><label for="status">حالة المعاينة<select id="status"><option value="all">كل الحالات</option>${statusOptions}</select></label></div>
<div class="results-row"><h2 id="library-title">المكتبة الحالية</h2><p id="result-count" aria-live="polite">${normalized.length} من ${normalized.length} عنصر</p></div><div class="cards">${normalized.map(renderCard).join('')}</div><div id="empty" class="empty"${normalized.length ? ' hidden' : ''}><strong>مفيش عناصر بالاختيارات دي</strong><p>جرّب اسم تاني أو وسّع الفلتر.</p></div></section>${renderGapPanel(gapReport)}</div>
<footer>معرض محلي للتصفّح والمراجعة. الفيديوهات بتشتغل لما تضغط تشغيل.</footer></main><script>${FILTER_SCRIPT}</script></body></html>`;
}
