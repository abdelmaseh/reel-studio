# Settings and creator profile

Open `node scripts/studio.mjs settings` for first-run profile setup or an explicit request to change defaults. Keep the process and browser open. Saved preferences are the starting point for new work; a one-video choice does not rewrite them.

## Settings and profile (PROFILE.json, schema 3)

«افتح إعداداتي» or a request to change defaults: open `node scripts/studio.mjs settings` as a long-running command and open its printed local URL. Verify the save with `node scripts/profile.mjs check`. Preserve profiles at session start. Schema 2 is readable without rewriting; screen saves migrate and back up. On a stale save, reload instead of overwriting a newer change.

Each preference independently uses `{"mode":"auto","value":null}` or `{"mode":"fixed","value":"<listed choice>"}`:

| Preference | Fixed choices |
| --- | --- |
| `style` | Any style id in the table in `instructions/STYLES.md` |
| `captionsGrouping` | `compact`, `clauses`, `single` |
| `captionsPresentation` | `pill`, `minimal`, `ink-strip` |
| `font` | `Cairo`, `Tajawal`, `Noto Naskh Arabic`, `Plex Display`, `Grid Sans`, `Noto Kufi Arabic`, `Readex Pro`, `El Messiri` |
| `writingStyle` | `short`, `educational`, `storytelling` |
| `digits` | `latin` (1 2 3), `arabic-indic` (١ ٢ ٣). Optional: `auto` or no entry keeps every number as written. |
| `palette` | `brand` (colours on supported styles). With `auto` each style keeps its own colours and the profile's brand colours are not used; set `fixed` `brand` for them to apply. |
| `character` | Optional, for the `cartoon` style: `{"mode":"fixed","value":{...}}` with `skin`, `hair` (`style` `short`, `quiff`, `long` or `none`, `color`), `headwear` (`kind` `none`, `hijab` or `cap`, `color`), `beard` (`kind` `none` or `full`, `color`), `glasses` (`kind` `none` or `rect`, `frame`), `eyes` (`iris`) and `outfit` (`kind` `tee` or `overshirt`, `top`, `base`); colours are `#RRGGBB`. No entry (or `auto`) uses the generic default figure. |

With the style on automatic, the assistant chooses each video's style from the styles' "Best for" lines and fit rules and says why in one line; `editor.mjs recommend` is only a second opinion. Explicit choices win. Style cards are illustrations; font previews use installed fonts and label missing downloads.

The assistant writes `preferences.character` only when the creator asks for their narrator, from the presets the creator picks; it is saved only in `PROFILE.json`, never a photo, and every cartoon video uses it unless a scene sets its own character. See [the cartoon guide](styles/cartoon.md).

**One video only:** keep PROFILE.json. Copy **all fields** printed by `node scripts/profile.mjs brief` into that video's brief. Add explicit `style`, `fontFamily`, `captionsGrouping`, `captionsPresentation`, `writingStyle` or `digits` only for a user-requested override; these win over saved defaults. In an open edit, the editor's «المظهر» tab changes this video's font, caption grouping and shape, and digits without touching PROFILE.json. Example: saved paper-collage/Tajawal + «الفيديو ده بس خطوات منظمة» → brief `style: "section-deck"`, retain `preferences`, omit `fontFamily` override so Tajawal stays fixed. Explain the chosen style in the preview; don't repeat settled questions.

### Fallback when this host cannot open a browser

Ask, one at a time, and never invent an answer:

1. Name (person or brand).
2. Social handle — optional; `null` if they have none.
3. Follow card at the end? Needs the handle.
4. Default comment keyword for the CTA — optional; they can change it for each video.
5. Their recorded sign-off — the exact words they say at the very end, optional.
6. Brand colours: primary and accent (`#RRGGBB`); background and text are optional (`null` keeps each style's own). Offer the example's colours if they have none.
7. Platforms: Instagram, TikTok and/or YouTube Shorts. Preserve existing selections; do not add a platform the creator did not choose.
8. Each preference above: automatic or fixed from its listed choices. Offer automatic when undecided.

Write it like `PROFILE.example.json` (schema 3, `language` "ar-EG", all six required `preferences`, plus `digits` when the creator chose one) and validate with `node scripts/profile.mjs check`. Relay Arabic errors and fix the answer. A request to change defaults authorizes that change; preserve all other fields. Prefer the screen's backed-up save.
