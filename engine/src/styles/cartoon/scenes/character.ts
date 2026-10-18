// Cartoon character: what a creator chooses, the colour tokens derived from it and the outline extents the safe-zone
// maths needs. Node-safe (no packages): branding.mjs validates PROFILE.json with the same rules.
import {EAR, earsVisible, headSilhouettePaths} from './kit/narrator/presets.ts';

export const HAIR_STYLES = ['short', 'quiff', 'long', 'none'] as const;
export const HEADWEAR = ['none', 'hijab', 'cap'] as const;
export const BEARDS = ['none', 'full'] as const;
export const GLASSES = ['none', 'rect'] as const;
export const OUTFITS = ['tee', 'overshirt'] as const;
export type Character = {
  skin: string;
  hair: {style: (typeof HAIR_STYLES)[number]; color: string};
  headwear: {kind: (typeof HEADWEAR)[number]; color: string};
  beard: {kind: (typeof BEARDS)[number]; color: string};
  glasses: {kind: (typeof GLASSES)[number]; frame: string};
  eyes: {iris: string};
  outfit: {kind: (typeof OUTFITS)[number]; top: string; base: string};
};
/** A generic invented figure: no beard, no glasses, short dark hair, warm skin, a blue-grey tee. Never a real person's look. */
export const DEFAULT_CHARACTER: Character = {
  skin: '#D9A882', hair: {style: 'short', color: '#2A2320'}, headwear: {kind: 'none', color: '#4B6B8A'}, beard: {kind: 'none', color: '#2A2320'},
  glasses: {kind: 'none', frame: '#17120F'}, eyes: {iris: '#5A3A28'}, outfit: {kind: 'tee', top: '#4B6B8A', base: '#F8F6F1'},
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const PARTS: Record<string, {keys: string[]; enums: Record<string, readonly string[]>; colours: string[]}> = {
  hair: {keys: ['style', 'color'], enums: {style: HAIR_STYLES}, colours: ['color']},
  headwear: {keys: ['kind', 'color'], enums: {kind: HEADWEAR}, colours: ['color']},
  beard: {keys: ['kind', 'color'], enums: {kind: BEARDS}, colours: ['color']},
  glasses: {keys: ['kind', 'frame'], enums: {kind: GLASSES}, colours: ['frame']},
  eyes: {keys: ['iris'], enums: {}, colours: ['iris']},
  outfit: {keys: ['kind', 'top', 'base'], enums: {kind: OUTFITS}, colours: ['top', 'base']},
};
/** Every fault, in words a creator can act on. Empty means the object is a valid character. */
export function characterIssues(value: unknown): string[] {
  if (!isRecord(value)) return ['character must be an object'];
  const issues: string[] = [];
  const allowed = ['skin', ...Object.keys(PARTS)];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`unknown field ${key}`);
  if (typeof value.skin !== 'string' || !HEX.test(value.skin)) issues.push('skin must be a #RRGGBB colour');
  for (const [part, shape] of Object.entries(PARTS)) {
    const v = value[part];
    if (!isRecord(v)) { issues.push(`${part} must be an object`); continue; }
    for (const key of Object.keys(v)) if (!shape.keys.includes(key)) issues.push(`unknown field ${part}.${key}`);
    for (const [key, options] of Object.entries(shape.enums)) if (!options.includes(v[key] as string)) issues.push(`${part}.${key} must be one of ${options.join(', ')}`);
    for (const key of shape.colours) if (typeof v[key] !== 'string' || !HEX.test(v[key] as string)) issues.push(`${part}.${key} must be a #RRGGBB colour`);
  }
  return issues;
}
/** The same character with upper-case colours; throws with every fault when it is not a valid character. */
export function normalizeCharacter(value: unknown): Character {
  const issues = characterIssues(value);
  if (issues.length) throw new Error(`cartoon character: ${issues.join('; ')}`);
  const c = value as Character;
  const up = (h: string) => h.toUpperCase();
  return {skin: up(c.skin), hair: {style: c.hair.style, color: up(c.hair.color)}, headwear: {kind: c.headwear.kind, color: up(c.headwear.color)},
    beard: {kind: c.beard.kind, color: up(c.beard.color)}, glasses: {kind: c.glasses.kind, frame: up(c.glasses.frame)}, eyes: {iris: up(c.eyes.iris)},
    outfit: {kind: c.outfit.kind, top: up(c.outfit.top), base: up(c.outfit.base)}};
}

// ---- colour maths (HSL lightness shifts keep each family's hue and saturation) ----
const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const rgbToHex = (r: number, g: number, b: number): string => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase()).join('');
export const hexToHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};
export const hslToHex = (h: number, s: number, l: number): string => {
  const S = Math.max(0, Math.min(100, s)) / 100, L = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};
/** The same hue and saturation, lightness shifted by `dl` points. */
export const shiftL = (hex: string, dl: number): string => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, l + dl); };

export type Tokens = {
  skin: {base: string; light: string; shade: string; deep: string; line: string; blush: string};
  lips: {base: string; deep: string}; hair: {base: string; hi: string}; beard: {base: string; hi: string; deep: string};
  frame: {base: string; hi: string}; iris: {mid: string; outer: string; pupil: string};
  top: {base: string; shade: string; light: string; deep: string; stitch: string}; under: {base: string; shade: string; deep: string};
  head: {base: string; shade: string}; neck: {shade: string};
};
/** Fixed lightness deltas; the creator only picks base colours. Lips derive from the skin, never from the beard. */
export function characterTokens(c: Character): Tokens {
  const [, , skinL] = hexToHsl(c.skin);
  return {
    skin: {base: c.skin, light: shiftL(c.skin, 8.3), shade: shiftL(c.skin, -8.2), deep: shiftL(c.skin, -17.6), line: shiftL(c.skin, -21.3), blush: hslToHex(14, 62, skinL)},
    lips: {base: hslToHex(4, 35, skinL - 14), deep: hslToHex(4, 35, skinL - 27)},
    hair: {base: c.hair.color, hi: shiftL(c.hair.color, 13.9)},
    beard: {base: c.beard.color, hi: shiftL(c.beard.color, 10.4), deep: shiftL(c.beard.color, -6.6)},
    frame: {base: c.glasses.frame, hi: shiftL(c.glasses.frame, 18.6)},
    iris: {mid: c.eyes.iris, outer: shiftL(c.eyes.iris, -10), pupil: '#120C09'},
    top: {base: c.outfit.top, shade: shiftL(c.outfit.top, -10), light: shiftL(c.outfit.top, 7.7), deep: shiftL(c.outfit.top, -19.4), stitch: shiftL(c.outfit.top, -16.1)},
    under: {base: c.outfit.base, shade: shiftL(c.outfit.base, -9), deep: shiftL(c.outfit.base, -17.7)},
    head: {base: c.headwear.color, shade: shiftL(c.headwear.color, -10)},
    neck: {shade: shiftL(c.skin, -30)},
  };
}

// ---- outline and extents ----
export type Pt = {x: number; y: number};
/** Points along an absolute SVG path made of M, L, Q, C and Z (the only commands the narrator art uses). */
export function samplePath(d: string, steps = 12): Pt[] {
  const tokens = d.match(/[MLQCZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: Pt[] = [];
  let i = 0, cur: Pt = {x: 0, y: 0}, start: Pt = {x: 0, y: 0}, cmd = '';
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLQCZ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') { cur = {x: num(), y: num()}; start = cur; out.push(cur); cmd = 'L'; }
    else if (cmd === 'L') { cur = {x: num(), y: num()}; out.push(cur); }
    else if (cmd === 'Q') {
      const c1 = {x: num(), y: num()}, to = {x: num(), y: num()}, from = cur;
      for (let k = 1; k <= steps; k += 1) { const t = k / steps, u = 1 - t; out.push({x: u * u * from.x + 2 * u * t * c1.x + t * t * to.x, y: u * u * from.y + 2 * u * t * c1.y + t * t * to.y}); }
      cur = to;
    } else if (cmd === 'C') {
      const c1 = {x: num(), y: num()}, c2 = {x: num(), y: num()}, to = {x: num(), y: num()}, from = cur;
      for (let k = 1; k <= steps; k += 1) {
        const t = k / steps, u = 1 - t;
        out.push({x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x, y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y});
      }
      cur = to;
    } else if (cmd === 'Z') { cur = start; cmd = ''; }
    else throw new Error(`samplePath: unsupported command in ${d}`);
  }
  return out;
}
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 24): Pt[] => Array.from({length: n}, (_, k) => ({x: cx + rx * Math.cos((2 * Math.PI * k) / n), y: cy + ry * Math.sin((2 * Math.PI * k) / n)}));

/** The upright head silhouette of a character in figure units (the same paths the narrator draws). */
export function headOutline(c: Character): Pt[] {
  const points = headSilhouettePaths(c).flatMap((d) => samplePath(d));
  if (earsVisible(c)) points.push(...ellipse(EAR.l.cx, EAR.l.cy, EAR.rx, EAR.ry), ...ellipse(EAR.r.cx, EAR.r.cy, EAR.rx, EAR.ry));
  return points;
}

/** The idle motion limits the extents cover: head tilt about (300, 610), body lean about (300, 1150), head bob. */
export const MOTION_LIMITS = {tiltDeg: 9.5, leanDeg: 3.85, bobDown: 6.5, bobUp: 5.5, headPivot: {x: 300, y: 610}, leanPivot: {x: 300, y: 1150}, chin: {x: 300, y: 590}} as const;
const rotate = (p: Pt, deg: number, o: Pt): Pt => {
  const a = (deg * Math.PI) / 180, dx = p.x - o.x, dy = p.y - o.y;
  return {x: o.x + dx * Math.cos(a) - dy * Math.sin(a), y: o.y + dx * Math.sin(a) + dy * Math.cos(a)};
};

/** Outline extents in figure units at the worst tilt, lean and bob: right and left of the chin line (x 300), above the chin (y 590), and the chin's travel below it. */
export type Extents = {headRight: number; headLeft: number; headTop: number; chinBottom: number};
export function characterExtents(c: Character): Extents {
  const L = MOTION_LIMITS, outline = headOutline(c);
  let maxX = -Infinity, minX = Infinity, minY = Infinity, chinY = -Infinity;
  for (const tilt of [-L.tiltDeg, 0, L.tiltDeg]) for (const lean of [-L.leanDeg, 0, L.leanDeg]) for (const bob of [-L.bobUp, L.bobDown]) {
    const pose = (p: Pt): Pt => { const t = rotate(p, tilt, L.headPivot); return rotate({x: t.x, y: t.y + bob}, lean, L.leanPivot); };
    for (const p of outline) { const q = pose(p); maxX = Math.max(maxX, q.x); minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); }
    chinY = Math.max(chinY, pose(L.chin).y);
  }
  return {headRight: Math.ceil(maxX - L.chin.x), headLeft: Math.ceil(L.chin.x - minX), headTop: Math.ceil(L.chin.y - minY), chinBottom: Math.ceil(chinY - L.chin.y)};
}
