// Reading rendered static markup in tests: the text nodes, entities decoded.
const decode = (text) => text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#x27;', "'");

/** Every non-blank text node of `html`, in document order. */
export const textNodes = (html) => html.replace(/<[^>]*>/g, '\n').split('\n').map(decode).filter((text) => text.trim() !== '');

/** The tokens of the text nodes that contain a digit of `pattern` (default: a Latin digit) and are not a handle, a hashtag, or a Latin+digit token. */
export function strayDigitTokens(html, {pattern = /[0-9]/, allow = []} = {}) {
  return textNodes(html).flatMap((node) => node.split(/\s+/)).filter((token) => pattern.test(token)
    && !/^[@#]/.test(token) && !(/[A-Za-z]/.test(token)) && !allow.includes(token));
}
