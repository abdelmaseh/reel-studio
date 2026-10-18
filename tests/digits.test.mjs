import test from 'node:test';
import assert from 'node:assert/strict';
import {displayDigitList, displayDigits, localizeSuffix, mapDigitTokens, mapsDigits, toArabicIndic, toLatinDigits} from '../engine/src/core/digits.ts';

test('Latin digits become Arabic-Indic with their separators and percent sign', () => {
  assert.equal(toArabicIndic('0123456789'), '٠١٢٣٤٥٦٧٨٩');
  assert.equal(toArabicIndic('1,234.5'), '١٬٢٣٤٫٥');
  assert.equal(toArabicIndic('50%'), '٥٠٪');
  assert.equal(toArabicIndic('v1.2.3'), 'v١٫٢٫٣');
  assert.equal(toArabicIndic('كلمة. ثم, كلمة'), 'كلمة. ثم, كلمة', 'a full stop or comma between words is not a separator');
  assert.equal(toArabicIndic('% ح'), '% ح', 'a percent sign without a digit before it stays');
});

test('a separator or percent sign next to a digit of either kind maps with it, so a mixed run is one number', () => {
  assert.equal(toLatinDigits('12,500٪'), '12,500%', 'an Arabic percent sign after Latin digits');
  assert.equal(toLatinDigits('3٫5'), '3.5');
  assert.equal(toLatinDigits('1٬234'), '1,234');
  assert.equal(toArabicIndic('٥٠%'), '٥٠٪', 'a Latin percent sign after Arabic-Indic digits');
  assert.equal(toArabicIndic('٣.٥'), '٣٫٥');
  assert.equal(toArabicIndic('١,٢٣٤'), '١٬٢٣٤');
  assert.equal(displayDigits('نسبة 12,500٪ اليوم', 'latin'), 'نسبة 12,500% اليوم');
  assert.equal(displayDigits('نسبة ٥٠% اليوم', 'arabic-indic'), 'نسبة ٥٠٪ اليوم');
  assert.equal(toArabicIndic('كلمة. ثم, كلمة ٥ ,'), 'كلمة. ثم, كلمة ٥ ,', 'punctuation that is not between digits stays');
});

test('Arabic-Indic and Persian digits become Latin with their separators', () => {
  assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
  assert.equal(toLatinDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  assert.equal(toLatinDigits('١٬٢٣٤٫٥'), '1,234.5');
  assert.equal(toLatinDigits('٥٠٪'), '50%');
});

test('a line with Latin letters and no Arabic keeps its digits', () => {
  assert.equal(mapsDigits('Top 10 tools'), false);
  assert.equal(mapsDigits('أفضل 10 أدوات'), true);
  assert.equal(mapsDigits('Top 10 أدوات'), true);
  assert.equal(mapsDigits('2024'), true, 'digits alone map');
  assert.equal(mapsDigits('٢٠٢٤ ab'), false, 'Arabic-Indic digits are not Arabic letters');
  assert.equal(displayDigits('Top 10 tools', 'arabic-indic'), 'Top 10 tools');
  assert.equal(displayDigits('أفضل 10 أدوات', 'arabic-indic'), 'أفضل ١٠ أدوات');
});

test('handles, hashtags, links and Latin+digit tokens are skipped', () => {
  assert.equal(displayDigits('تابع @user_12 و #خطة2024', 'arabic-indic'), 'تابع @user_12 و #خطة2024');
  assert.equal(displayDigits('زر example.com/a1 أو https://x.io/2 أو www.site2.com', 'arabic-indic'), 'زر example.com/a1 أو https://x.io/2 أو www.site2.com');
  assert.equal(displayDigits('استخدم GPT4 و 4K و mp4 في 2024', 'arabic-indic'), 'استخدم GPT4 و 4K و mp4 في ٢٠٢٤');
  assert.equal(displayDigits('الإصدار ChatGPT 4 رائع', 'arabic-indic'), 'الإصدار ChatGPT ٤ رائع', 'a bare number beside a Latin name maps; write one token or choose latin');
});

test('keep strings stay verbatim, even with digits', () => {
  assert.equal(displayDigits('اكتب 2024 وأرسل 2024', 'arabic-indic', {keep: ['2024']}), 'اكتب 2024 وأرسل 2024');
  assert.equal(displayDigits('اكتب خطة 30 الآن 30', 'arabic-indic', {keep: ['خطة 30']}), 'اكتب خطة 30 الآن ٣٠');
  assert.equal(displayDigits('أرقام 12 و 120', 'arabic-indic', {keep: ['12', '120']}), 'أرقام 12 و 120', 'the longest keep string wins at one place');
  assert.equal(displayDigits('اكتب ٢٠٢٤ الآن', 'latin', {keep: ['٢٠٢٤']}), 'اكتب ٢٠٢٤ الآن');
});

test('a keep string matches only as a whole token, never inside a longer number', () => {
  const arabicIndic = (text, keep) => displayDigits(text, 'arabic-indic', {keep});
  assert.equal(arabicIndic('احصل على 1000 فكرة', ['100']), 'احصل على ١٠٠٠ فكرة', 'the keyword 100 is not found inside 1000');
  assert.equal(arabicIndic('عام 12026', ['2026']), 'عام ١٢٠٢٦', 'the keyword 2026 is not found inside 12026');
  assert.equal(arabicIndic('عام 20261', ['2026']), 'عام ٢٠٢٦١', 'nor at the start of 20261');
  assert.equal(arabicIndic('100', ['100']), '100', 'the keyword alone stays as written');
  assert.equal(arabicIndic('اكتب 100 لتحصل على 1000', ['100']), 'اكتب 100 لتحصل على ١٠٠٠', 'the whole token stays and the longer number maps');
  assert.equal(arabicIndic('اكتب 100، ثم 1000.', ['100']), 'اكتب 100، ثم ١٠٠٠.', 'punctuation after the keyword is a boundary');
  assert.equal(arabicIndic('اكتب 100.', ['100']), 'اكتب 100.');
  assert.equal(arabicIndic('اكتب خطة30 الآن 30', ['خطة30']), 'اكتب خطة30 الآن ٣٠', 'a keyword that mixes letters and digits still matches whole');
  assert.equal(arabicIndic('خطة301', ['خطة30']), 'خطة٣٠١', 'but not as the start of a longer number');
  assert.equal(arabicIndic('أرقام 12 و 120 و 1200', ['12', '120']), 'أرقام 12 و 120 و ١٢٠٠', 'the longest keep string wins where it fits and no keep string cuts 1200');
  assert.equal(displayDigits('اكتب ١٠٠٠', 'latin', {keep: ['١٠٠']}), 'اكتب 1000', 'the same holds in the other direction');
  assert.equal(displayDigits('١٠٠0', 'latin', {keep: ['١٠٠']}), '1000', 'a digit of the other script is a digit too');
  assert.deepEqual(displayDigitList(['اكتب', '1000'], 'arabic-indic', {keep: ['100']}), ['اكتب', '١٠٠٠']);
});

test('a separator inside a number joins the digits around it, so a keep string is not found there either', () => {
  const arabicIndic = (text, keep) => displayDigits(text, 'arabic-indic', {keep});
  assert.equal(arabicIndic('سعر 1,100', ['100']), 'سعر ١٬١٠٠');
  assert.equal(arabicIndic('سعر 100,000', ['100']), 'سعر ١٠٠٬٠٠٠');
  assert.equal(arabicIndic('نسبة 3.100 و 100.5', ['100']), 'نسبة ٣٫١٠٠ و ١٠٠٫٥');
  assert.equal(displayDigits('سعر ١٬١٠٠', 'latin', {keep: ['١٠٠']}), 'سعر 1,100', 'Arabic separators join digits likewise');
  assert.equal(arabicIndic('اكتب 100, ثم 5', ['100']), 'اكتب 100, ثم ٥', 'a comma that no digit follows is punctuation');
  assert.equal(arabicIndic('اكتب 100 ثم 5.', ['100']), 'اكتب 100 ثم ٥.');
  assert.equal(arabicIndic('1.خطة30 و2.خطة60', ['خطة30']), '١.خطة30 و٢.خطة٦٠', 'a list number before a keyword that starts with a letter is not part of the keyword');
});

test('latin maps back likewise and mapping twice gives the same text', () => {
  assert.equal(displayDigits('أفضل ١٠ أدوات ٥٠٪', 'latin'), 'أفضل 10 أدوات 50%');
  for (const set of ['latin', 'arabic-indic']) {
    for (const text of ['أفضل 10 أدوات 50%', 'عدد ١٢٬٣٤٥', 'Top 10 tools', '', '   ', 'اقرأ 1.5']) {
      const once = displayDigits(text, set);
      assert.equal(displayDigits(once, set), once, `${set}: ${JSON.stringify(text)}`);
    }
  }
});

test('a missing or null set returns the very same string', () => {
  for (const set of [null, undefined]) {
    const text = 'أفضل 10 أدوات';
    assert.equal(displayDigits(text, set), text);
    assert.equal(localizeSuffix('%', set), '%');
    assert.deepEqual(displayDigitList(['أفضل', '10'], set), ['أفضل', '10']);
  }
});

test('the pieces of one caption line decide together', () => {
  assert.deepEqual(displayDigitList(['أفضل', '10', 'أدوات'], 'arabic-indic'), ['أفضل', '١٠', 'أدوات']);
  assert.deepEqual(displayDigitList(['Top', '10', 'tools'], 'arabic-indic'), ['Top', '10', 'tools'], 'an English line keeps its digits as a whole');
  assert.deepEqual(displayDigitList(['10'], 'arabic-indic'), ['١٠']);
  assert.deepEqual(displayDigitList(['اكتب', '2024'], 'arabic-indic', {keep: ['2024']}), ['اكتب', '2024']);
});

test('suffixes follow the set', () => {
  assert.equal(localizeSuffix('%', 'arabic-indic'), '٪');
  assert.equal(localizeSuffix('٪', 'latin'), '%');
  assert.equal(localizeSuffix('K', 'arabic-indic'), 'K');
  assert.equal(localizeSuffix('+', 'arabic-indic'), '+');
  assert.equal(localizeSuffix('/10', 'arabic-indic'), '/١٠');
  assert.equal(localizeSuffix('', 'arabic-indic'), '');
});

test('mapDigitTokens keeps whitespace exactly', () => {
  assert.equal(mapDigitTokens('  1   2 \n3', 'arabic-indic'), '  ١   ٢ \n٣');
});
