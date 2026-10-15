import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanPublicationFile} from '../scripts/lib/publication-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const lock = () => JSON.parse(read('versions.lock.json'));
const parts = version => version.split('.').map(Number);
const atLeast = (version, floor) => {
  const a = parts(version), b = parts(floor);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index];
  return true;
};

// Egyptian-dialect markers that must not appear in White Arabic release text (whole words, diacritics ignored).
const DIALECT = ['ده', 'دي', 'دا', 'دول', 'إزاي', 'ازاي', 'عايز', 'عاوز', 'عشان', 'كده', 'كدا', 'اللي', 'مش', 'قول', 'بتاع', 'بتاعك', 'دلوقتي', 'دلوقت', 'إيه', 'ايه', 'ليه', 'فين', 'أوي', 'خليه', 'خلي', 'هتلاقي'];
const strip = text => text.replace(/[\u064B-\u0652\u0670\u0640]/g, '');
const dialectIn = text => {
  const clean = strip(text);
  return DIALECT.filter(word => new RegExp(`(?<![\\u0621-\\u064A])${word}(?![\\u0621-\\u064A])`).test(clean));
};

const topEntry = () => read('CHANGELOG.md').split(/\n(?=## )/)[1];
const currentSection = () => {
  const text = read('README.md'), start = text.indexOf('<a id="whats-new"></a>');
  assert.ok(start >= 0, 'README has a whats-new anchor');
  return text.slice(start, text.indexOf('<a id="', start + 10));
};
const gridGlideCard = () => {
  const text = read('README.md'), at = text.indexOf('docs/images/style-grid-glide.jpg');
  assert.ok(at >= 0, 'README shows the Grid Glide card');
  return text.slice(text.lastIndexOf('<td', at), text.indexOf('</td>', at));
};

test('the release lock is at least 2.5.0 with engine 1.3.0 and every version file agrees', () => {
  const {edition, engine} = lock();
  assert.ok(atLeast(edition, '2.5.0'), `edition ${edition}`);
  assert.ok(atLeast(engine, '1.3.0'), `engine ${engine}`);
  assert.equal(JSON.parse(read('engine/package.json')).version, engine);
  const packageLock = JSON.parse(read('engine/package-lock.json'));
  assert.equal(packageLock.version, engine);
  assert.equal(packageLock.packages[''].version, engine);
});

test('the top changelog entry is the locked edition and a minor release ends with the update line', () => {
  const entry = topEntry(), first = entry.split('\n')[0];
  const heading = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/.exec(first);
  assert.ok(heading, `heading "${first}"`);
  assert.equal(heading[1], lock().edition);
  if (heading[1].endsWith('.0')) assert.match(entry, /^- \*\*التحديث:\*\*/m, 'minor releases end with the update line');
});

test('release text is White Arabic: no Egyptian-dialect markers in the new entry, section or card', () => {
  assert.deepEqual(dialectIn(topEntry()), [], 'CHANGELOG entry');
  assert.deepEqual(dialectIn(currentSection()), [], 'README what is new');
  assert.deepEqual(dialectIn(gridGlideCard()), [], 'README style card');
});

test('README header, navigation and new-section heading follow the locked edition', () => {
  const [major, minor] = parts(lock().edition), readme = read('README.md');
  assert.ok(readme.includes(`>Reel Studio ${major}.${minor} `), 'header');
  assert.ok(readme.includes(`<a href="#whats-new">الجديد في ${major}.${minor}</a>`), 'navigation');
  assert.ok(readme.includes(`## الجديد في ${major}.${minor}:`), 'section heading');
  assert.equal((readme.match(/<a id="whats-new"><\/a>/g) ?? []).length, 1, 'one current anchor');
});

test('the public wording rule asks for White Arabic', () => {
  const claude = read('CLAUDE.md');
  assert.ok(claude.includes('simple White Arabic'));
  assert.equal(/simple Egyptian Arabic/.test(claude), false);
});

test('NOTICE lists the Inter font', () => {
  assert.match(read('NOTICE.md'), /\bInter\b/);
});

test('the Sound-Kits README counts and recipe table match the catalog', () => {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const catalog = JSON.parse(read('Sound-Kits/catalog.json')), text = read('Sound-Kits/README.md');
  assert.match(text, new RegExp(`${words[catalog.sounds.length]} deterministic sounds`));
  assert.match(text, new RegExp(`${words[catalog.recipes.length]} reusable (?:multi-hit )?recipes`));
  for (const recipe of catalog.recipes) assert.ok(text.includes(`\`${recipe.id}\``), `${recipe.id} is listed`);
});

test('the release files pass the publication policy', () => {
  for (const file of ['CHANGELOG.md', 'README.md', 'CLAUDE.md', 'NOTICE.md', 'versions.lock.json', 'engine/package.json']) {
    assert.deepEqual(scanPublicationFile(file, Buffer.from(read(file))), [], file);
  }
});

const THANKS = 'شكرًا إنك نزّلت Reel Studio 🙏 الاستوديو بيبلّغني بإشارة صغيرة إن التثبيت نجح وإنك بتستخدمه، ومعاها رقم الإصدار. مفيش اسمك ولا فيديوهاتك ولا أي ملف من جهازك. الإشارة دي بتفرّحني وبتساعدني أعرف إن التحديثات بتوصلكم وشغالة.';

test('first-run setup ends with the thank-you line before the ready line', () => {
  const setup = read('instructions/SETUP.md');
  const thanks = setup.indexOf(`«${THANKS}»`), ready = setup.indexOf('«كده الاستوديو جاهز.');
  assert.ok(thanks > 0, 'SETUP.md quotes the thank-you line exactly');
  assert.ok(ready > thanks, 'the thank-you line comes first');
});

const SUPPORT_URL = 'https://store.pyraai.cloud/product/reel-studio/';
const SUPPORT_LABEL = 'ادعمنا واحجز جلستك';
// Every placement says the session is optional and paid, so it never reads as free support.
const OPTIONAL_PAID = /اختيارية[^\n]{0,20}(?:مدفوعة|تُدفع)|مدفوعة[^\n]{0,5}واختيارية/;

test('README links to support sessions at the start, in the FAQ, when setup stops and in the footer', () => {
  const readme = read('README.md'), link = `[${SUPPORT_LABEL}](${SUPPORT_URL})`;
  const hero = readme.slice(0, readme.indexOf('<a id="start"></a>'));
  assert.ok(hero.includes(`<a href="${SUPPORT_URL}"><b>${SUPPORT_LABEL}</b></a>`), 'start of the page');
  assert.match(hero, OPTIONAL_PAID);
  const faq = readme.slice(readme.indexOf('## أسئلة سريعة'), readme.indexOf('## أدلة للمساعد'));
  const entries = faq.split('<details>').slice(1);
  const help = entries.find(entry => entry.includes('تحتاج مساعدة مباشرة'));
  assert.ok(help?.includes(link), 'its own FAQ entry');
  assert.match(help, OPTIONAL_PAID);
  assert.deepEqual(dialectIn(help.replace(/<[^>]+>/g, '')), []);
  const stopped = entries.find(entry => entry.includes('التجهيز وقف'));
  assert.ok(stopped?.includes(link), 'the setup-stopped answer');
  assert.match(stopped, OPTIONAL_PAID);
  assert.ok(readme.slice(readme.lastIndexOf('\n---\n')).includes(link), 'the footer');
});

test('the install thank-you and the settings screen offer the support link', () => {
  const setup = read('instructions/SETUP.md');
  const thanks = setup.indexOf(`«${THANKS}»`), support = setup.indexOf(`${SUPPORT_LABEL}: ${SUPPORT_URL}»`), ready = setup.indexOf('«كده الاستوديو جاهز.');
  assert.ok(thanks > 0 && support > thanks && ready > support, 'support line sits between the thank-you and ready lines');
  assert.match(setup.slice(thanks + THANKS.length, support), OPTIONAL_PAID);
  const html = read('scripts/settings-ui/index.html');
  const anchor = html.match(/<a class="support-link"[^>]*>/)?.[0];
  assert.ok(anchor, 'settings sidebar has the support link');
  for (const attribute of [`href="${SUPPORT_URL}"`, 'target="_blank"', 'rel="noopener noreferrer"']) assert.ok(anchor.includes(attribute), attribute);
  assert.ok(html.includes(`<strong>${SUPPORT_LABEL}</strong>`));
  assert.match(html.slice(html.indexOf('class="support-link"')), OPTIONAL_PAID);
});

test('README explains the install counter in White Arabic', () => {
  const readme = read('README.md'), at = readme.indexOf('يرسل الاستوديو إشارة صغيرة');
  assert.ok(at > 0, 'README has the counter paragraph');
  const paragraph = readme.slice(readme.lastIndexOf('\n\n', at), readme.indexOf('\n\n', at));
  for (const fact of ['رقم الإصدار', 'رمز عشوائي', 'فيديوهات', 'ملفات']) assert.ok(paragraph.includes(fact), fact);
  assert.deepEqual(dialectIn(paragraph), []);
});
