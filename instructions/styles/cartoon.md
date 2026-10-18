# cartoon

Arabic label: كارتون. English label: Cartoon. Introduced in 3.0.0.

An illustrated narrator stands in front of alternating paper and night grounds that flip through a circle opening from its head. It points at simple cards in the middle of the frame while a big headline builds word by word on the recorded words, and it waves goodbye over the recorded sign-off. The creator never appears on screen: the narrator explains for them, with the creator's own voice.

This is a newer style, so always show the fast preview (`EDITING.md` step 5) first. If it shows clipped text, a broken layout or an unreadable frame, say so in one line and offer another style. Never deliver a style whose preview failed.

Read [EDITORIAL.md](../EDITORIAL.md) first. Shared rules (choosing a style, endings) live in [STYLES.md](../STYLES.md). This style needs a named recording with clear speech: graphics mode cannot host it, because the voice drives the mouth, the headline and every beat.

## Look

- Three act palettes that take turns: a warm paper ground with ink words and an orange accent, a night ground with light words and a lime accent, and the same paper ground with a pink accent. Paper and night always alternate; the new ground opens as a hard-edged circle from the narrator's head.
- The narrator is a flat illustrated figure from the waist up with a soft accent glow and an offset halftone shadow. It blinks, nods on every word, looks at what its hand points at and opens its mouth with the loudness of the recording.
- The headline replaces subtitles: one sentence at a time near the top, every word rising on its own recorded onset. Latin words and numbers are set in a serif italic in the accent colour; Arabic words use the display face.
- A thin top band carries the act tag on the right and an honest counter on the left. Cards are white (graphite on night) and rounded, with mono labels, black stamps and accent pills.

## Best for

An explainer or tutorial where the creator would rather not be on camera, with one idea per sentence that a simple card can show: a term, two programs talking, a few tools, a line of code, a choice in a grid, one layer on top of another.

## Layouts and footage

- Both families are `takeover` scenes that fill the frame. The whole recording is one `cartoon` body scene plus one `cartoon-ending` scene; together they must cover the complete timeline, so the recorded picture never shows. Set `sourceKind` to `"cartoon"` in the brief: the manifest then has no presenter, delivery takes the no-presenter route and the director refuses any other family or any gap.
- Recorded caption pills never draw over these scenes; the headline is the caption. Picture-in-picture is not part of this style.
- The only footage is the optional `monitor` card: the creator's real screen capture (image or video) inside a drawn monitor. Confirm the privacy blur with the creator before any preview, as for every screen recording.
- Everything is laid out inside the Instagram Reels safe area. The narrator's head stays out of the action rail on the right: at the body scale its centre stays between about x 245 and x 662, and the validator refuses a place outside the box measured for the chosen character. Hands may pass the rail while pointing.
- Author at 30, 50 or 60 fps. Every time is written in seconds or as a word anchor, so only `durationInFrames` changes with the frame rate.

## Palette and brand

- **Brand colours:** not applied. The style keeps its own act palettes; relay the plan notice in one line.
- Paper `#EEEBE4` with ink `#141414`, accent `#E8472B` and accent text `#BF3D27`; night `#0D0D0E` with ink `#F4F3EE` and lime `#D5F53B`; pink acts use accent `#FF3D8B` with accent text `#C0326B`. Every text colour reaches 4.5:1 on its ground and card; pills on the accent use dark text.
- Fonts: `Plex Display` for the headline, handle and term cards (a creator font preference replaces it), `IBM Plex Mono` for tags, the counter, code and labels, and `Source Serif 4` italic for Latin words in the headline. Existing installs run the fonts step of setup once after updating, so the italic face is the real one.
- Digits follow the creator's digits choice in the counter and in the headline.

## Recipe

**Direction:** an illustrated narrator explains while the creator's voice speaks

- **Decision:** Choose it when the creator wants a faceless explainer with a friendly presenter and the recording has one clear idea per sentence. Do not choose it when the creator's face is the point of the video, when there is no recording, or when the script has no idea a simple card can show.
- **Composition/material:** The narrator stands low in the frame, cards sit in the middle band and the headline sits at the top.
  - **Acts.** Split the recording into two to six acts at real changes of idea; each act lasts at least 3 s and has a short tag such as `// 02 — the idea`. Paper and night alternate, so `light` and `pink` never follow each other.
  - **Sentences.** Group the reviewed words into sentences of four to eight words that tile the scene with no gap; a sentence must fit three headline lines (two while a `monitor` card is on screen), and the validator names the sentence to shorten or split. Mark at most two Arabic accent words per sentence; Latin words and numbers are accents automatically.
  - **Cards.** One card at a time, chosen from the vocabulary below, with copy the creator wrote. Never quote anyone in a card or a stamp. Icons come from a fixed list and shapes are circle, triangle, square or pill.
  - **Character.** The creator picks skin, hair, headwear, beard, glasses, eye colour and outfit from built-in presets; the assistant saves the choice once as `preferences.character` in the profile. Without it the generic default figure is used. A photo is never the character.
- **Timing/action:** Every time is a word anchor: `{"word": <index of the reviewed word>, "dt": <seconds>}`, so cues follow the recorded speech and survive cuts.
  - **Flips.** The flip into a new act is derived: 0.36 s before the act's first word, never earlier than 0.06 s after the previous act's last word, and it must lead the first word by 0.2 to 0.5 s; tight words are refused with the sentence named.
  - **Words.** Each headline word rises on its own onset; the sentence swaps on the next sentence's first word, and fades only across a flip.
  - **Narrator.** When no places or gestures are written, the narrator stands opposite the card it points at, points when a card lands, opens both hands toward items that arrive, rests its chin on a fist for code and gives a thumb on a counter stop. Places change at least 1.4 s apart.
  - **Counter.** `sections` shows the act number (`PART 02/05`). A `seconds` counter is allowed only when the recording says the number: its `saidAt` word must contain those digits, and it stops with a check at the real end of the explanation. A `timer` card needs a seconds counter.
  - **Mouth.** The mouth follows the loudness of the recording, calibrated per recording at prepare time into `prepared/mouth.json`. It is amplitude only: separate letters are not shaped.
- **Transition/sound:** The circle reveal is the only full-frame change. Effects follow [SOUND.md](../SOUND.md).
  - Use `"sound": "auto"`: the palette places a soft air pass on every flip (`cartoon-flip`), one impact for a stamp, a crossed block or a layer drop (`cartoon-stamp`), a small pop for a link, a cable, an arrow or a morph, the click and chime for the follow tap, a soft pop when a card lands or the counter stops, and typing for code lines.
  - Words, entrances and the narrator stay silent. Nothing sounds at or after the sign-off tail.
- **Application/review:** Build and check in this order.
  1. Review the transcript, then write one `cartoon` beat and one `cartoon-ending` beat from the reviewed words (acts at idea changes, sentences, cards, the ending parts that are on for this video), with `sourceKind: "cartoon"`.
  2. Plan and prepare; check that `prepared/mouth.json` exists and read the mouth line of the prepare summary (fewer than two seconds of speech is NEEDS-REVIEW).
  3. Show the fast preview and render stills at each flip, at every card's busiest moment, at the follow tap and in the tail, in Arabic copy with Latin words and digits. Check that no word is clipped, the headline stays inside three lines and the narrator's head stays out of the rail.
  4. Run `node scripts/safe-check.mjs --comp PreparedEdit --props-file Projects/<slug>/prepared/props.json --step 0.1` and fix every finding.
  5. Render the real video and ask the creator to play it with sound, including the flips, a stamp, the tap and the sign-off tail, following [VISUAL-REVIEW.md](../VISUAL-REVIEW.md). Technical checks are not creative acceptance.

## Style-owned scenes

Both families are registered once and are valid only with `style: "cartoon"`. Read `engine/src/styles/cartoon/scenes/schema.ts` for the exact limits. Both scenes have `layout: "takeover"`.

| Family | Purpose | Data |
| --- | --- | --- |
| `cartoon` | The body: every act except the last | `character`, `acts`, `sentences`, `accents`, `counter`, `brackets`, `cards`, optional `places`, `gestures` and `tail` |
| `cartoon-ending` | The last act: comment part, follow part and the quiet tail | `character`, `fromTheme`, `theme`, `tag`, `entrance`, `sentences`, `accents`, `comment`, `follow`, `tail` |

Body fields:

| Field | Limits | Rule |
| --- | --- | --- |
| `character` | presets below | Optional; the director fills it from `preferences.character`, else the generic default. The ending carries the same object. |
| `acts[]` | 2 to 6; `theme` `light`, `dark` or `pink`; `sentence`; `tag` up to 24 characters | Act 1 starts at sentence 0; consecutive acts alternate paper and night; each act lasts at least 3 s; the flip time is derived. |
| `sentences[]` | 1 to 60, each 1 to 12 words (`from`, `to` are reviewed word indices) | Tile the scene's words in order; at most three headline lines, two over a `monitor` card. |
| `accents[]` | word indices | Inside a sentence; at most two Arabic accents per sentence. |
| `counter` | `null`, `{"kind": "sections"}` (default) or `{"kind": "seconds", "total", "saidAt", "stop", "label"}` | A seconds counter needs the spoken number at `saidAt` and a `stop` after it. |
| `brackets` | boolean, default true | Viewfinder corners around the narrator during the first sentence. |
| `cards[]` | up to 30 | `from` and `to` are word anchors, or `"flip"` for the last card of an act (it ends 0.2 s after the flip); windows never overlap; `id` is unique. |
| `places[]`, `gestures[]` | optional | Validated when present (inside the narrator safe box, anchors that resolve); derived from the cards when absent. |
| `tail` | `{"at"}` | Only when the body is the last scene: the quiet tail over the recorded sign-off. |

Card vocabulary (all copy is the creator's):

| Kind | Data | Beats (optional word anchors) |
| --- | --- | --- |
| `term` | `tag`, `term` (up to 16), `glyphs` (up to three shapes) | glyphs pop in turn |
| `windows` | `left` and `right` (`name`, `tag`), `linkLabel` | `rightAt`, `leftAt`, `linkAt` |
| `fan` | `items` (2 to 4: `name`, `icon`, `shape`), `caption` | `hitAt[]` |
| `code` | `filename` and `lines` (1 to 4, Latin, up to 34 characters, each with `at`) | each line types from its `at` |
| `link` | `left` (`icon`, `label`), `right` (`tag`, `label`, `shape`), `stamp` | `rightAt`, `stampAt`, `leftAt`, `cableAt` |
| `grid` | `items` (3 to 6: `icon`, `name`), `picked`, `command` (Latin) | `pickAt`, `runAt` |
| `crossed` | `title`, `tiles` (4 to 8), `lit` | `crossAt` |
| `stack` | `layers` (two: `text`, `shapes`, `tone`), `stamp`, `arrowLabel` | `dropAt`, `stampAt`, `arrowAt` |
| `nodes` | `nodes` (2 to 3: `icon` or `text`, `label`), `rings` | `at[]`, `ringsAt` |
| `morph` | `items` (2 to 3 shapes), `beforeLabel`, `afterLabel`, `equalsBefore`, `equalsAfter` | `morphAt`, `oneAt` |
| `monitor` | `clip` (`src`, `sha256`, `width`, `height`, `kind` image or video), `trimBeforeFrame`, `crop` (`x`, `y`, `w` in file pixels), `label` | the window shows the capture through a fixed 22:9 opening; the crop stays inside the file and may not enlarge it more than 1.25 times |
| `timer` | `label` | counts down the spoken total; needs a seconds counter |

Ending fields: `fromTheme` equals the body's last act theme and differs in ground from `theme`, because the ending opens with a reveal; `entrance` equals the body's last place; at least one of `comment` (`keyword` = this video's CTA keyword, `promise`, `at`) and `follow` (`handle` = the complete profile handle, `message`, `at`, `tapAt`, `shareAt`); `comment.at` comes before `follow.at`, and `follow.at` before `tapAt`. The follow card shows the character's own head as the avatar, never a photo. The ending must start exactly where the body ends; the ending's first word must come 0.2 to 0.5 s after that start.

The sign-off tail: `tail.at` is the first word of the recorded sign-off. From there the band and the headline are gone, the cards have left, the narrator moves to the centre at full size and waves to the end of the edit, and nothing sounds. The sign-off itself is never trimmed or covered by an effect. This is the only scene allowed to run over the recorded sign-off, and only when its tail starts at or before the sign-off and it ends at the edit end.

Character presets: `skin` (any colour), `hair.style` `short`, `quiff`, `long` or `none`, `headwear.kind` `none`, `hijab` or `cap`, `beard.kind` `none` or `full`, `glasses.kind` `none` or `rect`, `eyes.iris`, `outfit.kind` `tee` or `overshirt` with `top` and `base` colours. Shades, lips and highlights are derived from the base colours.

What the creator provides: the named recording with clear speech and its reviewed transcript; the character choices once (or nothing, for the default); the copy of tags, cards, stamps and the follow message; optional screen captures for the `monitor` card with the privacy blur confirmed; the profile handle and this video's CTA keyword and promise when they apply; a seconds counter only when the recording states the number; approval of the act plan and of the fast preview; and a listen to the final video.

Honest limits: the mouth follows loudness only; the hair presets are the four above and headwear is `hijab` or `cap`; creator-made character art cannot be imported yet; the headline and band are laid out right to left for Arabic videos; the delay between the picture and the voice was measured on real renders at 30 and 50 fps (a pulse in the mouth table against a tick in the sound): the mouth opened on the tick's own frame every time, with a mean offset of about 5 ms (0.15 frame at 30 fps, 0.26 frame at 50 fps), so the mouth is read without a shift.

## Avoid

- A seconds counter or a timer whose number the recording does not say.
- Card or stamp copy that quotes someone, or any copy the creator did not write.
- A sentence that needs more than three headline lines, or letter-spaced Arabic.
- A place that puts the narrator's head in the action rail, or a photo used as the character.
- The shared `follow` or `comment` scenes in this style: the ending parts live in `cartoon-ending`.
- A hand-placed whoosh, a music bed, or any sound over the sign-off.
