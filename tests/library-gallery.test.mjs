import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const moduleUrl = new URL('../scripts/lib/library-gallery.mjs', import.meta.url);
const gallery = () => import(moduleUrl);
const item = (overrides = {}) => ({
  key: 'concept:problem-solution', labelAr: 'مشكلة وحل', labelEn: 'Problem / solution',
  layer: 'concept', style: 'clean', status: 'rendered', video: 'videos/0001.mp4',
  durationSec: 4.5, scope: 'مثال صامت من غير تصوير.', notes: [], ...overrides,
});

test('each current selection card explains its meaning, use and limit; new registered items remain preview pending',async()=>{
  const {galleryViewData}=await import('../scripts/lib/library-gallery-copy.mjs');
  const existing=item();
  const guide={assessment:'current',role:'explanation',moods:['calm'],energy:['low'],display:{explains:'نفس الموضوع قبل وبعد.',useWhen:'لما الفرق نفسه هو الفكرة.',avoidWhen:'لو الحالتين مش لنفس الموضوع.'}};
  const entries=[{...existing,kind:'concept',editorial:guide},{key:'scene:new',nativeId:'new',kind:'scene',layer:'scene',editorial:{...guide,labelAr:'مشهد جديد'}}];
  const view=galleryViewData([existing],{gaps:[]},{items:[]},{items:entries});
  const {renderLibraryGallery}=await gallery();
  const html=renderLibraryGallery(view);
  assert.match(html,/نفس الموضوع قبل وبعد/);assert.match(html,/لما الفرق نفسه هو الفكرة/);assert.match(html,/لو الحالتين مش لنفس الموضوع/);
  assert.match(html,/هادي/);
  assert.equal(view.items.find(item=>item.key==='scene:new').status,'pending');
  const stale=galleryViewData([existing],{gaps:[]},{items:[]},{items:[{...entries[0],editorial:{...guide,assessment:'stale'}}]});
  assert.doesNotMatch(renderLibraryGallery(stale),/نفس الموضوع قبل وبعد/);
});

test('visual findings follow only the reviewed poster hash and stay visible in the gallery',async()=>{
  const {galleryViewData}=await import('../scripts/lib/library-gallery-copy.mjs');
  const review={posterSha256:'reviewed-poster',notes:['الختم بيغطي تسمية الكارت.']};
  const render=(posterSha256)=>galleryViewData([item({posterSha256,visualReview:review})],{gaps:[]},{items:[]});
  const current=render('reviewed-poster');
  assert.ok(current.items[0].notes.includes('ملاحظة مراجعة: الختم بيغطي تسمية الكارت.'));
  const {renderLibraryGallery}=await gallery();
  assert.match(renderLibraryGallery(current),/ملاحظة مراجعة: الختم بيغطي تسمية الكارت/);
  assert.ok(!render('new-poster').items[0].notes.some(note=>note.includes('الختم')));
});

test('real report summary objects and current effect layers keep a readable Arabic introduction',async()=>{
  const {renderLibraryGallery}=await gallery();
  const html=renderLibraryGallery({items:[item({layer:'kinetic-emphasis'})],gapReport:{summary:{count:7},gaps:[]}});
  assert.match(html,/panel-intro">ترتيب مقترح/);
  assert.match(html,/تأكيد الكلام الحركي/);
});

test('available videos are explicitly supplied, lazy, and separate from creator acceptance', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({items: [item(), item({key: 'effect:glow', status: 'pending', video: undefined})]});
  assert.match(html, /<html[^>]+lang="ar"[^>]+dir="rtl"/);
  assert.equal((html.match(/<video\b/g) || []).length, 1);
  assert.match(html, /src="videos\/0001.mp4"/);
  assert.match(html, /preload="none"/);
  assert.doesNotMatch(html, /\bautoplay\b|https?:\/\//);
  assert.match(html, /concept:problem-solution/);
  assert.match(html, /موافقة/);
});

test('rendered records with no video are shown as pending instead of available', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({items: [item({video: undefined})]});
  assert.doesNotMatch(html, /<video\b/);
  assert.match(html, /data-status="pending"/);
  assert.match(html, /مفيش فيديو/);
});

test('display text cannot inject markup, scripts, or reveal source and private paths', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({
    title: '</title><script>alert(1)</script>',
    items: [item({labelAr: '<img src=x onerror=alert(2)>', notes: ['Render failed at D:\\Private\\client-secret.mov'], source: 'private-recording.mov'})],
    gapReport: {items: [{key: 'gap:unsafe', title: '<svg onload=alert(3)>', rationale: '</script><script>alert(4)</script>', scope: 'C:\\Users\\Private\\source.mp4'}]},
  });
  assert.doesNotMatch(html, /<img src=x|<script>alert|<svg onload/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
  assert.doesNotMatch(html, /client-secret|source\.mp4|private-recording|D:\\Private|C:\\Users/);
  assert.match(html, /مسار محلي مخفي/);
});

test('media paths reject traversal, absolute files, external URLs, and attribute injection', async () => {
  const {renderLibraryGallery} = await gallery();
  for (const video of ['../secret.mp4', 'videos/../secret.mp4', '/secret.mp4', 'C:\\secret.mp4', 'https://x.test/a.mp4', '//x.test/a.mp4', 'videos/%2e%2e/a.mp4', 'videos/a.mp4" onerror="alert(1)', 'videos//a.mp4']) {
    assert.throws(() => renderLibraryGallery({items: [item({video})]}), /relative media path/i, video);
  }
  assert.throws(() => renderLibraryGallery({items: [item({poster: '../poster.jpg'})]}), /relative media path/i);
});

test('private POSIX paths are redacted from display-only notes too', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({items: [item({notes: ['Error at /root/customer/private-recording.mov']})]});
  assert.doesNotMatch(html, /\/root\/customer|private-recording/);
});

test('gap priorities include rationale and scope without implying implemented features', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({items: [], gapReport: {summary: 'اقتراحات للمكتبة.', items: [{key: 'gap:continuity', labelAr: 'استمرار نفس العنصر', priority: 1, rationale: 'عشان المقارنة تبقى واضحة.', scope: 'حركة جديدة لعنصر واحد.'}], limitations: ['الترتيب تقديري.']}});
  assert.match(html, /استمرار نفس العنصر/);
  assert.match(html, /عشان المقارنة تبقى واضحة/);
  assert.match(html, /حركة جديدة لعنصر واحد/);
  assert.match(html, /الترتيب تقديري/);
  assert.match(html, /gap:continuity/);
  assert.doesNotMatch(html, /<video\b/);
});

test('gap scores are presented as ranked recommendations with their reason', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({items: [], gapReport: {gaps: [{key: 'gap:continuity', labelAr: 'استمرار العنصر', priority: 97, priorityBand: 'high', rank: 1, rationale: 'يوضح الفكرة.', reason: 'الموجود الحالي بيبدّل العناصر.', scope: 'مكوّن واحد.'}]}});
  assert.match(html, /الموجود الحالي بيبدّل العناصر/);
  assert.doesNotMatch(html, /أولوية 97/);
  assert.match(html, /أولوية عالية/);
});

test('generated filters combine search, layer and status and report a real empty state', async () => {
  const {renderLibraryGallery} = await gallery();
  const html = renderLibraryGallery({items: [item({labelAr:'مُشْكلة وأَفْكار'}), item({key: 'effect:glow', labelAr: 'وهج', labelEn: 'Glow', layer: 'effect', status: 'failed', video: undefined})]});
  const nodes = [...html.matchAll(/<article class="motion-card"([^>]+)>/g)].map((match) => {
    const attrs = Object.fromEntries([...match[1].matchAll(/data-([a-z]+)="([^"]*)"/g)].map((attribute) => [attribute[1], attribute[2]]));
    return {dataset: attrs, hidden: false};
  });
  const controls = Object.fromEntries(['search', 'layer', 'status'].map((id) => [id, {value: '', listeners: {}, addEventListener(type, handler) {this.listeners[type] = handler;}}]));
  controls.layer.value = 'all';
  controls.status.value = 'all';
  const resultCount = {textContent: ''};
  const empty = {hidden: true};
  const document = {querySelectorAll(selector) {return selector === '.motion-card' ? nodes : [];}, getElementById(id) {return controls[id] || (id === 'result-count' ? resultCount : empty);}};
  const script = html.match(/<script>([\s\S]+?)<\/script>/)?.[1];
  assert.ok(script, 'standalone output has a filter controller');
  vm.runInNewContext(script, {document});
  assert.deepEqual(nodes.map((node) => node.hidden), [false, false]);
  controls.search.value='مشكله وافكار';controls.search.listeners.input();
  assert.deepEqual(nodes.map(node=>node.hidden),[false,true]);
  controls.search.value = 'glow'; controls.search.listeners.input();
  assert.deepEqual(nodes.map((node) => node.hidden), [true, false]);
  controls.layer.value = 'concept'; controls.layer.listeners.change();
  assert.deepEqual(nodes.map((node) => node.hidden), [true, true]);
  assert.equal(empty.hidden, false);
  controls.search.value = ''; controls.layer.value = 'all'; controls.status.value = 'rendered'; controls.status.listeners.change();
  assert.deepEqual(nodes.map((node) => node.hidden), [false, true]);
  assert.equal(empty.hidden, true);
  assert.match(resultCount.textContent, /1/);
});
