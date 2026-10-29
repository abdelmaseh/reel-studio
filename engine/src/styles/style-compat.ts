// Node-safe migration metadata. These are the removed styles' recorded policies, not product choices.
import {STYLE_ALIASES, getStyleMeta, normalizeStyleId, defaultFontFor as nativeFontFor, defaultCaptionsFor as nativeCaptionsFor, clauseCaptionsDefault as nativeClausesFor} from './registry.ts';

export const STYLE_ALIAS_IDS = Object.keys(STYLE_ALIASES) as [keyof typeof STYLE_ALIASES, ...(keyof typeof STYLE_ALIASES)[]];
const POLICIES = {
  "split-canvas": {
    "font": "Cairo",
    "captionsPresentation": "pill",
    "clauseCaptions": false,
    "pip": true,
    "staticCaptions": true
  },
  "scrapbook-route": {
    "font": "Tajawal",
    "captionsPresentation": "pill",
    "clauseCaptions": false,
    "pip": false,
    "staticCaptions": false
  },
  "stepped-editorial": {
    "font": "Plex Display",
    "captionsPresentation": "ink-strip",
    "clauseCaptions": false,
    "pip": true,
    "staticCaptions": false
  },
  "judgment-board": {
    "font": "Plex Display",
    "captionsPresentation": "ink-strip",
    "clauseCaptions": false,
    "pip": true,
    "staticCaptions": false
  },
  "campaign-tickets": {
    "font": "Cairo",
    "captionsPresentation": "ink-strip",
    "clauseCaptions": false,
    "pip": false,
    "staticCaptions": false
  }
} as const;

/** Preserve origin across saves so an explicit old PiP/emphasis keeps working in its replacement. */
export function normalizeManifestStyle(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  if (typeof raw.style !== 'string' || !Object.hasOwn(STYLE_ALIASES, raw.style)) return value;
  return {...raw, style: normalizeStyleId(raw.style), styleAlias: raw.style};
}

export function aliasPolicy(style: string, alias?: string) {
  if (!alias || !Object.hasOwn(STYLE_ALIASES, alias) || STYLE_ALIASES[alias as keyof typeof STYLE_ALIASES] !== style) return null;
  return POLICIES[alias as keyof typeof POLICIES];
}

export function staticCaptionsFor(style: string, alias?: string): boolean {
  return aliasPolicy(style, alias)?.staticCaptions ?? getStyleMeta(style).defaults.staticCaptions;
}

/** Read origin defaults only for a matching migration; explicit manifest choices still win. */
export function clauseCaptionsFor(style: string, alias?: string): boolean {
  return aliasPolicy(style, alias)?.clauseCaptions ?? nativeClausesFor(style);
}
export function defaultFontFor(style: string, alias?: string) {
  return aliasPolicy(style, alias)?.font ?? nativeFontFor(style);
}
export function defaultCaptionsFor(style: string, alias?: string) {
  return aliasPolicy(style, alias)?.captionsPresentation ?? nativeCaptionsFor(style);
}

/** Same-font aliases retain the renderer's existing implicit typography and caption weight. */
export function aliasFontOverride(style: string, alias?: string) {
  const font = aliasPolicy(style, alias)?.font;
  return font !== undefined && font !== nativeFontFor(style) ? font : undefined;
}
