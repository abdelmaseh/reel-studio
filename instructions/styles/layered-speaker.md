# layered-speaker

Arabic label: حوالين المتكلم. English label: Layered speaker. Introduced in 4.0.0.

The speaker stays full frame, and a few key words sit around them as if the picture had depth: one big word whose long stretch passes behind the head while its letters stay visible on both sides, short words beside or above the head, and a hand-drawn mark (a circle, a band, a strike, an arrow or an underline) that draws itself on the key word. The depth comes from a cut-out of the speaker (the matte) drawn above the big word.

This is a newer style, so always show the fast preview (`EDITING.md` step 5) first. If it shows clipped text, a stretch that crosses the face, a ragged cut-out edge or an unreadable frame, say so in one line and offer another style. Never deliver a style whose preview failed.

Read [EDITORIAL.md](../EDITORIAL.md) first. Shared rules (choosing a style, endings) live in [STYLES.md](../STYLES.md). This style needs a named recording with a presenter on screen: graphics mode cannot host it.

## Look

- The picture is the creator's own, untouched. Every word is heavy white with a thin dark outline, a hard drop shadow and a soft one; one word per scene may take the marker yellow instead.
- The big word is set in the display face (`Cairo` weight 900) and stretched with a kashida: only the connecting bar grows, so the letters keep their joined shapes. The bar covers the head plus a margin on each side, and the letters sit left and right of the head.
- Words beside the head lean a few degrees toward it and rise in from their own side. A line above the head drops in from the top.
- Marks are drawn by a seeded hand: a slightly different wobble for every word, the same wobble on every render. Each one draws on in 0.3 to 0.5 s.

## Best for

An opinion, a story or a hook where the creator's face carries the video and one to three words deserve the poster treatment.

## Layouts and footage

- The scene is always `presenter`: the speaker's picture is the base layer and the scene only adds words and the matte on top. Recorded captions stay on screen under it (the one style-owned family that keeps them); keep the scene's words to the key words, not the speech.
- Everything the scene paints stays above y 1100 and inside the Instagram Reels safe area (65 px sides). The prepare step measures the head box for every layered scene (the same head guide the headline scenes use), and the words are laid out around it.
- Picture-in-picture is not part of this style: the layering needs the full-frame speaker.
- Author at 30, 50 or 60 fps. Times are frames inside the scene.

## Palette and brand

- **Brand colours:** not applied. The style keeps its own palette; relay the plan notice in one line.
- Ink night `#12161C`, white words, marker yellow `#FFD23F` for the accent word and every mark. Shared scene families drawn under this style use the same tokens, and every text pair reaches 4.5:1.
- Fonts: `Cairo` for every word (a creator font preference replaces it for the words beside the head; the big word is tested with `Cairo`). Digits follow the creator's digits choice in the words beside the head; the big word is always an Arabic word.

## Recipe

**Direction:** key words layered around the speaker

- **Decision:** Choose it when the creator is on camera and the point lands in one to three words. Do not choose it for a long explainer, when the speaker is far from the camera or half out of frame, or when the speech needs the screen for the captions alone.
- **Composition/material:** One scene holds up to four words, one per place: `behind` (the big word), `above`, `left`, `right`.
  - **The big word.** One Arabic word of 3 to 12 letters with a connection that can stretch (a legal kashida slot, for example كبير or الفرق). The schema refuses a word with no slot, a Latin word, a number, or two words. With a matte it passes behind the head; without one it sits above the head, so a second line above it is refused.
  - **Words beside and above the head.** Up to 26 characters, fitted to the free strip beside the head box (at least 150 px wide). If a strip is too narrow the render stops and names the word; move it to the other side.
  - **Marks.** At most two per scene, each on one word, starting after the word has landed and fully drawn before the scene ends. Pick the kind by meaning: circle for "this one", band for a highlight, strike for what is wrong, arrow for a pointer, underline for a quiet stress.
- **Timing/action:** `atFrame` is a frame inside the scene. The big word lands with a short fade and its bar grows over about 0.7 s; each word needs 0.6 s on screen; the scene fades out over its last 0.2 s. A scene lasts at least 1.2 s and never runs across a cut, because the matte follows the source frames.
- **Transition/sound:** Effects follow [SOUND.md](../SOUND.md). Use `"sound": "auto"`: the palette places one soft pop when the big word lands and one marker tap when a mark touches down. The scene start, the words beside the head and the bar growing stay silent.
- **Application/review:** Build and check in this order.
  1. Pick the moment (a claim, a turn, a hook word) and write one `layered-speaker` beat with the words, then plan.
  2. For a big word behind the head, cut the matte: `node scripts/matte.mjs status`, then `node scripts/matte.mjs make --source Raw/<file> --project <slug>` (add `--start-frame` and `--frames` to cut only the scene), then `node scripts/matte.mjs attach --manifest Projects/<slug>/edit.json --scene <scene id> --matte <the src printed by make>`. A creator-supplied alpha video works the same way if it has the source's cadence, aspect and frame count.
  3. Prepare, show the fast preview and render stills at the moment the big word lands, at the end of the bar growth, at each mark and in the last frames, in Arabic copy.
  4. Run `node scripts/head-check.mjs`: a scene with a matte reports `behind-subject-matte` as NEEDS-REVIEW, which needs a written decision after looking at the stills (edges, hair, hands crossing the bar). A scene without a matte must PASS.
  5. Run `node scripts/safe-check.mjs --comp PreparedEdit --props-file Projects/<slug>/prepared/props.json --step 0.1` and fix every finding.
  6. Render the real video and ask the creator to play it with sound, following [VISUAL-REVIEW.md](../VISUAL-REVIEW.md). Technical checks are not creative acceptance.

## Style-owned scenes

One family, registered once and valid only with `style: "layered-speaker"`. Read `engine/src/styles/layered-speaker/scenes/schema.ts` for the exact limits. The scene has `layout: "presenter"`.

| Family | Purpose | Data |
| --- | --- | --- |
| `layered-speaker` | Key words behind and around the speaker, with hand-drawn marks | `words` (1 to 4) and an optional `foreground` (the matte) |

Fields:

| Field | Limits | Rule |
| --- | --- | --- |
| `words[].place` | `behind`, `above`, `left`, `right` | Each place at most once. `behind` and `above` cannot both be used without a matte. |
| `words[].text` | 1 to 26 characters; `behind`: one Arabic word, 3 to 12 letters, with a legal kashida slot | Copy the creator wrote; never invented. |
| `words[].atFrame` | inside the scene, at least 0.6 s before the end | The frame the word lands. |
| `words[].accent` | true or omitted | Marker yellow instead of white; use on one word. |
| `words[].mark` | `kind`: `circle`, `band`, `strike`, `arrow`, `underline`; `atFrame` | At most two marks in the scene; the pen lands at or after the word, and the draw (0.3 to 0.5 s) ends inside the scene. |
| `foreground` | `src`, `sourceSha256`, `sourceFromFrame`, `frames`, `trimBeforeFrame` | Written by `matte.mjs attach`. It must cover the scene and match the presenter's continuous source frames; the manifest refuses it otherwise. |

## Avoid

- Putting a long phrase behind the head: only one stretched word fits, and the letters on both sides are what the viewer reads.
- Choosing it when the cut-out is ragged (loose hair against a busy wall, a hand crossing the bar all the time): look at the stills before anything else.
