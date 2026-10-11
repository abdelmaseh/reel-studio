import {PLATFORM_LABELS} from './publish-pack.mjs';

// The post description is a search card and a teaser: it may name what the video covers, never retell it.
export const KEYWORD_WINDOW = Object.freeze({instagram: 125, tiktok: 100});
export const MAX_SPOKEN_RUN = 5;
export const MAX_SPOKEN_SHARE = 0.2;
export const MAX_PLATFORM_SHARE = 0.5;
const FILLER_HASHTAGS = new Set(['#fyp', '#foryou', '#foryoupage', '#explore', '#explorepage', '#viral']);

// Words compared without tashkeel, tatweel, letter variants (alef, hamza on waw or yaa, yaa, taa marbuta),
// punctuation, emoji or case; Arabic-Indic digits read as 0-9.
export function captionWords(text) {
  return text.normalize('NFC')
    .replace(/[ً-ٰٟـ️‍]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/[ىئ]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6F0))
    .replace(/#[^\s#]+/g, ' ')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .toLowerCase().split(/\s+/).filter(Boolean);
}

// The reviewed spoken words of a project manifest as one text ('' when there are none).
export function spokenText(manifest) {
  return (manifest?.captions?.words ?? []).map((word) => word.text).join(' ');
}

// 3-word phrases; a caption of one or two words is a single phrase, so identical short captions still compare.
const phrases = (words) => words.length < 3 ? (words.length ? [words.join(' ')] : [])
  : words.slice(0, words.length - 2).map((_, i) => words.slice(i, i + 3).join(' '));

// The words shown before «more», counted in characters so an emoji is never cut in half; a word the cut splits is dropped.
function openingWords(caption, limit) {
  const chars = Array.from(caption);
  const words = captionWords(chars.slice(0, limit).join(''));
  const longer = captionWords(chars.slice(0, limit + 1).join(''));
  if (longer.length === words.length && longer.at(-1) !== words.at(-1)) words.pop();
  return words;
}

function longestSpokenRun(words, spoken) {
  let best = [];
  for (let i = 0; i < words.length; i++) {
    for (let j = i + best.length + 1; j <= words.length; j++) {
      if (!spoken.includes(` ${words.slice(i, j).join(' ')} `)) break;
      best = words.slice(i, j);
    }
  }
  return best;
}

export function checkCaptionCopy({copy, platforms, spokenText: spokenCopy, keyword = null}) {
  const spokenWords = captionWords(spokenCopy);
  const spoken = ` ${spokenWords.join(' ')} `;
  const spokenPhrases = new Set(phrases(spokenWords));
  const searchPhrase = keyword ? ` ${captionWords(keyword).join(' ')} ` : null;
  const failures = [];
  const report = {};
  const own = {};
  for (const platform of platforms) {
    const label = PLATFORM_LABELS[platform];
    const {caption, hashtags} = copy[platform];
    const words = captionWords(caption);
    own[platform] = phrases(words);
    const share = own[platform].length ? own[platform].filter((phrase) => spokenPhrases.has(phrase)).length / own[platform].length : 0;
    const run = longestSpokenRun(words, spoken);
    if (run.length > MAX_SPOKEN_RUN) failures.push(`${label}: repeats ${run.length} spoken words in a row («${run.join(' ')}»). Say the idea in new words.`);
    if (share > MAX_SPOKEN_SHARE) failures.push(`${label}: ${Math.round(share * 100)} % of its 3-word phrases come from the spoken words (at most ${MAX_SPOKEN_SHARE * 100} %). Tease the video instead of retelling it.`);
    if (searchPhrase && !` ${openingWords(caption, KEYWORD_WINDOW[platform]).join(' ')} `.includes(searchPhrase)) {
      failures.push(`${label}: the search phrase «${keyword}» is not in the first ${KEYWORD_WINDOW[platform]} characters.`);
    }
    for (const tag of hashtags) if (FILLER_HASHTAGS.has(tag.toLowerCase())) failures.push(`${label}: ${tag} is a filler hashtag. Use a tag about the topic.`);
    report[platform] = {characters: Array.from(caption).length, hashtags: hashtags.length, spokenPhrasePercent: Math.round(share * 100), longestSpokenRun: run.length};
  }
  for (let i = 0; i < platforms.length; i++) {
    for (let j = i + 1; j < platforms.length; j++) {
      const a = new Set(own[platforms[i]]), b = new Set(own[platforms[j]]);
      const smaller = Math.min(a.size, b.size);
      const share = smaller ? [...a].filter((phrase) => b.has(phrase)).length / smaller : 0;
      if (share > MAX_PLATFORM_SHARE) failures.push(`${PLATFORM_LABELS[platforms[i]]} and ${PLATFORM_LABELS[platforms[j]]} share ${Math.round(share * 100)} % of their phrases. Write each platform separately.`);
    }
  }
  return {ok: failures.length === 0, failures, platforms: report};
}
