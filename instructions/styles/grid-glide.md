# grid-glide

Arabic label: كلمات وكروت. English label: Grid glide. Introduced in 2.5.0.

Words glide into an already finished layout on one curve. Real screen captures sit still in bevelled cards. Scenes leave as rigid slabs that end in a hard cut, and the only sound is a few low hits.

**The sentence that generates the style:** the world is flat and still; words glide into an already finished layout on one curve, and scenes leave as rigid slabs that end in a hard cut. If you are adding blur to a word, fading a scene, reflowing a line, tilting a card or putting a whoosh on anything, you have stopped applying this style.

This is a newer style, so always show the fast preview (`EDITING.md` step 5) first. If it shows clipped text, a broken layout or an unreadable frame, say so in one line and offer another style. Never deliver a style whose preview failed.

Read [EDITORIAL.md](../EDITORIAL.md) first. Shared rules (choosing a style, brand colours, endings) live in [STYLES.md](../STYLES.md), family contracts in [MOTION-CHOICES.md](../MOTION-CHOICES.md) and source-free authoring in [GRAPHICS.md](../GRAPHICS.md).

## Look

- A flat light-grey canvas, one ink colour and a faint watermark line near the bottom of the frame. Nothing else decorates the world; the optional dotted grid belongs to a hook scene only.
- Two type tiers: small lead-in words and one bold hero phrase per block, plus at most one inverted dark box line per scene.
- Dead-still bevelled cards hold real screen captures. A bevelled pill names the tool in a chapter scene and carries the Follow label in the follow card; its dark tile appears only when the pill holds a logo, otherwise the label is centred. Four-point sparkles lead the bullets.
- Motion is one entrance curve: every word rises into place over 30 frames, with no blur, scale or overshoot. Scenes slide in on the same curve and leave as rigid slabs on its mirror.
- Sound is a handful of low-frequency hits on cuts, a small click on each pill and silence everywhere else.
- The ending is drawn in the same grammar: the approved keyword is the hero of the comment scene, and the complete handle is the hero of the follow scene above its Follow pill.

## Best for

- Enumerable explainers ("five tools", "three steps", "four modes") where each item has something real to show in a card. Tutorials and comparisons fit when each step or side has its own capture.
- Faceless videos: the voice, or the reviewed authored copy, is the performer.
- Not for a script with no screen material per item. Say so when you choose the style, before writing the beats, and propose fewer, bigger hero scenes with bullets, or another style.

## Layouts and footage

- The five style-owned families (`glide-chapter`, `glide-card`, `glide-lines`, `glide-comment`, `glide-follow`) are `takeover` scenes and exist only in this style; the manifest refuses them in any other style. Captions are hidden while one of them is on screen, because the scene draws its own words.
- Picture-in-picture is not part of this style. A presenter scene may sit between Grid Glide scenes; join it by hard cuts.
- Shared families (`screens` and the others that support `takeover`) keep their own layout support, are drawn in this style's register (flat canvas, bevelled card) and change by hard cuts. The shared `comment` and `follow` are the exception: they draw their header lines in the shared card style, so this style ends with `glide-comment` and `glide-follow` instead. The delivery check accepts either pair, and a plan that uses the shared pair here carries a notice.
- Real captures live inside cards only: a public-local file under `engine/public/` with its exact `sha256`, `width` and `height`, checked at preparation. Never use a floating, tilted or full-bleed recording in this style.
- Author at 30, 50 or 60 fps. Frame counts in this guide are at 30 fps. Scale every start frame and scene length you write (`at`, `heroAt`, `pillAt`, `fromFrame`, `durationInFrames`) by fps / 30. Do not scale `cadence`: it is a rhythm in 30 fps frames, and the engine stretches it together with the whole motion law (entrance, slide, push, pill, sparkle, box wipe, dip and the default pill delay), so a scene lasts the same time in seconds at every frame rate.
- A line, box or bullet that contains any Arabic letter is laid out right to left, and Latin tool names inside it stay joined in reading order; a text with no Arabic letter reads left to right.

## Palette and brand

- Canvas `#F2F2F2`, card face `#F9F9F7`, ink `#242424`, inverted box `#262626` with text `#F4F4F4`, pill face `#E5E5E5`, logo tile `#191919` (drawn only when a pill carries a logo). There is one ink colour; emphasis is size, weight and position only.
- Brand colours are not applied: the style keeps its monochrome identity. Relay the plan notice in one line (for example: "الستايل ده بيفضل بألوانه هو").
- Font: `Grid Sans`, an alias that combines Inter (Latin and digits) with IBM Plex Sans Arabic (400 to 700), so a mixed Arabic and Latin line is measured and drawn with one family. It is this style's default and appears in the font choices.
- Arabic has no italic and no case: the accent role uses weight (700 inside a 500 line) or the box, never slant. Latin tokens and tool names stay Latin inside Arabic lines; digits stay as written unless the video's digits choice is `arabic-indic` or `latin`.

## Recipe

- **Decision:** Choose it when the message is a countable list and every item can show something real.
  - **Fit check.** Each chapter needs at least one real capture or still to put in a card. If the script has no screen material per item, say so when you choose the style, before writing the beats. The style supplies the look, not the wording: on-screen lines may drop words (verbs-only bullets) but never reorder or rewrite recorded or reviewed words, and they are explanatory labels, not literal subtitles.
  - **Segment the script into scenes at sentence gaps.** A scene is one clause or one sentence group. Nothing is cleared inside a scene; the whole scene leaves at once. With a recorded voice the next scene starts one to five frames before its first audible word and is never held more than about six frames past its sentence end; with authored copy it starts at the reviewed reading moment.

    | Scene | Family | Use it for | Enter | Exit | Sound |
    | --- | --- | --- | --- | --- | --- |
    | Hook (optional) | `glide-lines`, `grid: true` | the stake: lead-in, hero, one box | `cut` | `cut` into the first chapter | boom once at frame 0 |
    | Chapter | `glide-chapter` | every item or step: ordinal hero and tool pill | `cut` after a hook or a vertical push, otherwise `slide` | `push` left or right, alternating | thump at the cut, click on the pill |
    | Content | `glide-card` | what the item does: caption lines, a card with real captures, bullets | `slide` from the side opposite the previous push | `push` up or down, or `cut` | thump at the cut |
    | Recap | `glide-lines` | restate the value or bridge to the call to action | `dip` | `dip` into the next recap, otherwise `cut` | swell at the dip |
    | Call to action | `glide-comment` | lead-in lines, the keyword exactly as approved as the hero, an optional promise box | `cut` or `dip` | `cut` | thump at the cut |
    | Follow | `glide-follow` | optional lead-in lines, the complete handle as the hero and the FOLLOW pill | `cut` | `cut` | thump at the cut, click on the pill |
    | Sign-off | no scene | the recorded sign-off | none | none | none |

  - **Lengths.** A chapter is 60 frames: one blank frame, the second ordinal word 7 frames after the first, the pill 14.75 frames after the first word starts, and the push over the last 15 frames. If the voice after a short chapter title is shorter than the scene, leave the silence rather than shortening the pill timing. A content scene is as long as its sentence group needs.
- **Composition/material:** Pick the roles from the words, then lay each scene out once, in its final geometry.
  - **Lead-in and hero.** Every clause splits into small connective words (role `lead`) and one hero keyword group at the end of the clause (role `hero`) on its own line. The hero is the object noun phrase or the payoff: what you give, where it lands, the quantity and the nouns that define scope, the benefit qualifier. Hero type is 1.4 to 2 times the lead-in. At most three style steps in a block. Lines hold up to four words by default and never more than six, broken at clause boundaries.
  - **Ordinals and tools.** Ordinals ("first", "second") are the chapter hero. Tool names go in the pill, in uppercase Latin spelling, never as plain text.
  - **Box.** At most one per scene: the stake or qualifier of the beat, three to five words, an inverted box revealed by one continuous wipe. It is fixed width with the text fitted, never overflowing.
  - **Bullets.** The result phrases of the item's second sentence, verbs first, three to five words, fillers dropped but order kept. Zero to four per card scene; zero is fine when the card carries the scene.
  - **Text normalisation.** Latin tokens stay Latin and digits follow the video's digits choice (as written when none is set); a spoken "and" may be shown as "&"; drop terminal full stops on hero lines.
  - **Layout budget (Instagram band).** The band is y 250 to 1470 with sides x 65 to 1015, and the action rail occupies x 853 and beyond for y 1150 and below. Budget per scene: caption block + gap (38 to 80) + card + gap (about 65) + lower block must not exceed 1220 px. One example fits exactly: three lines at 70, 100 and 70 px with line height 1.3 (312 px, y 250 to 562), a gap of 38, a 16:9 card (y 600 to 1065), a gap of 65 and three bullets at a 120 px pitch (rows at y 1130, 1250 and 1370; the last ends at 1453). A 4:3 card (591 px high) or a 1.3 card (638 px) costs a bullet or a line. Remedies in order: drop or merge a line or bullet; crop the capture wider so the card is shorter; scale type uniformly down to 0.85 (lead-in 60 px, bullets 56 px). Never shrink the card width below about 827 px.
  - **Rail.** A card's bottom stays at or above y 1150, or its right edge at or left of x 853. Below y 1150 centred lines stay within 626 px, and in Arabic the bullet star sits near x 790 with the text column at x 65 to 702. Text that does not fit fails the render instead of clipping.
  - **Card material.** Width 827, outer radius 24, a 9 px inset screen with radius 15, a stacked 1 px bevel and a two-layer shadow on the right and bottom only. The card never moves, tilts or scales. Its media change only by hard cuts on a reviewed beat or on the text cadence; a tall still may scroll inside the card (`scroll`).
- **Timing/action:** One curve, a fixed cadence per block, and line-by-line anchors for Arabic.
  - **Entrance.** For a word with start `s` (the frame where progress is 0): progress = OUT((f - s) / 30), opacity = progress, rise = A x (1 - progress). OUT is cubic-bezier(0, 0, 0, 1). Frame `s` shows nothing; the first visible frame is `floor(s) + 1`; fractional starts are allowed. The engine fixes the rise by block type: 130 px for chapter and hero stacks, 80 px for caption blocks, and a horizontal slide of 1.5 times the font size for bullets. Nothing else moves: no blur, scale, overshoot or sideways motion on ordinary words.
  - **Cadence.** Frames per word inside a block, constant and not keyed to the voice: hero pair 7, caption blocks 6.5, 7, 7.5 or 6 (one per scene), bullets 5, recap 7.5. A line's `cadence` accepts 4 to 9.
  - **Anchors for Arabic.** A spoken Arabic token lasts about 12.6 frames at 30 fps, so the text metronome always outruns the voice. Anchor each line separately: `at` = first-word onset - 4 frames, then keep the cadence inside the line. The last word of an n-word line leads its spoken onset by 4 + (n - 1)(12.6 - c) frames: 15 frames for n = 3 at c = 7, 19 for n = 4 at c = 7.5. Keep lines to three or four words, or split a long phrase into two lines with their own anchors.
  - **Voice onsets** come from the reviewed alignment or an envelope-checked recognition, never from a rough timestamp at a chapter boundary. A chapter hero lands 0 to 4 frames before its onset.
  - **Box.** The wipe lasts 7.5 x words + 0.5 frames (3 words: 23, 4 words: 30.5, 5 words: 38) and starts about 3 frames before the phrase's first spoken word. In right-to-left text it wipes from right to left.
  - **Pill.** It slides in from the left over 21.75 frames by 660.6 px, with opacity rising linearly from 2.5 frames after its start over 10.8 frames. The label is fitted between 50 and 72 px.
  - **Sparkle.** It scales up over 8.5 frames while unwinding 16 degrees, and starts 2 frames before its row's first word.
  - **Cues before leaving.** Every cue begins at least 4 frames (scaled by fps / 30) before the exit begins: the start of the last word of each line and bullet, of the last ordinal word, of the box and of the pill. A push exit begins 15 frames (scaled) before the scene ends, a dip exit 5 frames (scaled) and a cut exit at the end of the scene. A word may still be settling when the exit begins; the manifest refuses a scene only when a cue starts too late.
- **Transition/sound:** Only these moves exist, all inside the style-owned scenes; the shared transition system is not used. Effects follow [SOUND.md](../SOUND.md).
  - **Slide-in.** `slide` from the side opposite the previous push, 400 px (500 for a bigger arrival) over 30 frames on the entrance curve. The scene is opaque from its first frame.
  - **Push out.** `push` over the last 15 frames on the mirrored curve, cubic-bezier(1, 0, 1, 1). The 15th frame is the next scene, so the cut lands at peak speed. Use 400 px left or right for chapters and hooks and 200 px up or down for content scenes. Chapter pushes alternate right and left, and the next content scene slides in from the opposite side. A vertical push leaves one blank frame (the next hero's first frame); a horizontal push leaves none. The canvas, grid and watermark do not move.
  - **Hard cut.** `cut` for a static hold followed by a cut (a hook into the first chapter) and for every change into or out of a shared family.
  - **Dip.** `dip` for recaps only: a whole-frame blur peaking near 15 px (watermark included) and a dark vignette bump around the boundary, split over the outgoing scene's last five frames and the incoming scene's first five. The old scene disappears in one frame at the peak. An exit `dip` must be followed immediately by a scene whose enter is `dip`.
  - **Never** crossfade or fade a scene, flash white, wipe, zoom between scenes or add a whoosh. Chapters and content change by pushes and cuts, recaps by dips; do not invent a third family.
  - **Sound.** Five deterministic low voices: a boom (`sub-boom`) once at frame 0 when the edit opens on a Grid Glide scene (a normal `sounds[]` entry); a thump (`sub-thump`) on every scene cut, leading it by 0.27 s so the pre-swell plays during the push and the hit lands just after the cut; a click (`ui-click`) 5 frames after each pill starts (a chapter's tool pill and the follow pill); a swell (`sub-swell-hit`) on each dip, leading it by 0.2 s; a thud (`sub-thud`) for the `swap` cue, leading it by 0.13 s. Nothing on words, bullets, sparkles, box wipes, slides or in-card cuts, and nothing after a recorded sign-off starts.
  - **Level.** The mix places the sound stem relative to the voice. Ask the creator to play a passage with sound to confirm the balance; adjust the palette gains or the stem level in an audio revision ([PRODUCTION.md](../PRODUCTION.md)).
- **Application/review:** Build and check in this order.
  1. Run the fast preview on a 10 to 20 second passage with one chapter, one card with three bullets, one box line and one dip. In Arabic it must prove the right-to-left box wipe, the mirrored bullets and the line-anchor timing.
  2. Write a per-scene timing table before laying anything out: scene cut frames, line anchors, cadence per block, pill starts and push starts.
  3. Render stills at the first visible frame of each hero, pill, box and bullet, at the last frame of each hold, at the blank frame and at the dip peak, in Arabic and in Latin text with digits.
  4. Check against the style: no easing other than the three curves; no blur or scale on words; frame `s` of each entrance invisible; the blank frame exactly where expected; no frame between the last pushed frame and the cut; card offsets 0 during holds; a hit on every scene cut and none elsewhere.
  5. Right to left: lines read right to left with the hero last in reading order; the box wipes right to left; bullets are mirrored (star on the right, words sliding in from the left); no letter-spacing on Arabic and no per-character animation; Latin runs and digits stay joined.
  6. Inspect the safe zones with the guides (nothing in the top 250 px, below y 1470 or in the rail except the dressings), each card against the rail, and the complete handle on a follow card.
  7. Review the actual MP4 with stills and checks and ask the creator to play it with sound, following [VISUAL-REVIEW.md](../VISUAL-REVIEW.md). Technical checks are not creative acceptance.

### Decision order

1. Scene boundaries sit in voice gaps: a scene starts one to five frames before its first audible word and never holds more than about six frames past its sentence end. A scene is one clause or one sentence group; nothing is cleared inside a scene; the whole scene leaves at once.
2. Lead-in → hero: every clause splits into small connective words and one hero keyword group at the end of the clause on its own line (the object, the quantity with its nouns, the benefit, the payoff). At most three style steps per block; lines follow the four-words-by-default rule under Composition/material.
3. Every item that glides in needs its real capture; without one the style does not fit the video.
4. Sound: a low landing per slab, inside the `grid-glide` band of `scripts/data/sound-bands.json`; no sweeps.

## Style-owned scenes

The families below are registered once and are valid only with `style: "grid-glide"`. Read `engine/src/styles/grid-glide/scenes/schema.ts` for the exact limits. Every frame is relative to the scene start.

| Family | Purpose | Data |
| --- | --- | --- |
| `glide-chapter` | open each item or step | `ordinal` (1 to 2 words, up to 30 characters), `heroAt`, optional `pill` (`label` up to 24 characters, optional `logo`), optional `pillAt` (default `heroAt + 14.75`, scaled by fps / 30), `enter`, `exit`, optional `watermark` |
| `glide-card` | show what the item does | `lines` (0 to 4), optional `box`, `media.clips` (1 to 6), `bullets` (0 to 4, default none), `enter`, `exit`, optional `watermark` |
| `glide-lines` | hook, recap | `lines` (1 to 5), optional `box`, `grid` (default false, hook dressing), `enter`, `exit`, optional `watermark` |
| `glide-comment` | the comment call to action | `lines` (1 to 3), `keyword` (1 to 3 words, up to 20 characters; it must equal the brief's `creator.ending.cta`), `heroAt`, optional `box` (the promise), `enter`, `exit`, optional `watermark`. The keyword is chosen per video (`--cta`); a keyword of more than 3 words or 20 characters cannot be used by `glide-comment`, so pick a shorter `--cta`. |
| `glide-follow` | the follow card | `lines` (0 to 2, default none), `handle` (the complete profile handle, `@` plus up to 30 characters), `heroAt`, `pill` (`label` up to 24 characters, no logo), optional `pillAt` (default `heroAt + 14.75`, scaled by fps / 30), `enter`, `exit`, optional `watermark` |

Shapes:

- **line:** `{words, role, at, cadence}` with 1 to 6 words of 1 to 40 characters, `role` either `lead` or `hero`, `at` the frame where the first word starts (fractions allowed) and `cadence` 4 to 9 in 30 fps frames (default 7, never scaled by hand).
- **box:** `{text, at}` with 1 to 60 characters and at most 6 words; at most one per scene.
- **clip:** `{at, src, sha256, width, height, kind, scroll}` where `at` is an integer frame, `kind` is `image` or `video`, and the optional `scroll` `{from, to}` runs from 0 to 1 inside a tall still. The first clip starts at 0 and clips are in time order. `src`, `sha256`, `width` and `height` follow the public-local asset rule.
- **bullet:** `{text, at}` with 1 to 48 characters and at most 5 words.
- **enter:** `{kind: "cut"}`, `{kind: "slide", from: "left" | "right", distance: 400 | 500}` or `{kind: "dip"}`.
- **exit:** `{kind: "cut"}`, `{kind: "push", dir: "left" | "right" | "up" | "down"}` or `{kind: "dip"}`.
- **keyword:** the comment hero. One row at the stack rise of 130 px, drawn at the largest size from 150 down to 100 px that fits the 950 px column. A keyword that does not fit at 100 px fails the render.
- **handle:** the follow hero, always one left-to-right token drawn whole. It is fitted from 100 down to 40 px: a long ordinary handle (31 characters of mixed letters and digits) shrinks to about 46 px and fits the 950 px column, and one made only of the widest letters needs more than 40 px allows and fails the render. The handle is never cut or shortened.
- **pill (follow):** `{label}` only. A pill without a logo has no dark tile and its label is centred; the follow pill is the chapter pill, so it slides in and clicks the same way.
- **watermark:** up to 40 characters, drawn faintly near the bottom and never moving with the scene. It is drawn at 75 px; a long text shrinks down to 36 px, and a text wider than the 950 px column at 36 px fails the render. The director fills it from the profile handle when there is one and the creator has not turned it off, into every Grid Glide scene except `glide-follow` (that card's hero already is the complete handle, so a follow scene shows a watermark only if you write one); in authored graphics write it yourself or leave it out. Never hard-code a handle in a template.

Timing rules and limits:

- Cues are ordered and inside the scene: lines, the box, bullets and clips are listed in time order and never start at or after the scene's end. Every line, box, bullet and pill cue also starts at least 4 frames (scaled) before the exit begins.
- A chapter needs at least 60 frames at 30 fps (scaled by fps) so the pill and the push fit.
- An ending holds still before it leaves: its last element (the last lead-in word, the keyword, the box wipe or the pill slide, whichever finishes last) is settled at least 24 frames (scaled) before the exit begins. The generic cue rule alone would let a cue start 4 frames before a cut and leave the keyword unreadable, so the manifest also refuses an ending that rests for less.
- The follow pill starts at `pillAt`, or 14.75 frames (scaled) after the handle starts, and settles 21.75 frames (scaled) later; it cannot start before the handle. The comment box cannot start before the keyword, and the keyword and the handle cannot start before their lead-in lines.
- Typical lengths at 30 fps: a comment scene 105 to 120 frames, a follow scene 75 to 90. For example a lead-in at 6, the keyword at 24 and a four-word box at 50 finish at frame 80.5, so 105 frames hold them; a lead-in at 6, the handle at 16 and the default pill finish at frame 52.5, so 77 frames are enough.
- Words come from reviewed recorded words or reviewed authored copy. Displayed lines may drop words but keep their order.
- Media and logos must be public-local files whose `sha256` and pixel size match the scene; preparation refuses a mismatch.
- Text that does not fit fails the render; it is never clipped.
- **Editing and briefs:** each family has an editable template and Arabic field labels in the review editor, and the enter and exit kinds and directions are editable fields. A new ending scene in the editor already carries the profile's comment word and handle when the profile has them. In a brief, a beat whose `intent` is the family id selects the family; the layout defaults to `takeover`. The director never writes the ending for you: author the two beats from the printed `creator.ending` and the profile handle, the comment first and the follow card last, each only when it is on for this video.

Ending beats, ready to copy (the keyword is the brief's `creator.ending.cta`, the handle the complete profile handle, and the sign-off, when on, comes after both):

```json
{"id": "ask", "fromSec": 24, "toSec": 28, "intent": "glide-comment", "data": {
  "lines": [{"words": ["Want", "the", "template"], "role": "lead", "at": 6}],
  "keyword": "PLAN", "heroAt": 24,
  "box": {"text": "the question list", "at": 50},
  "enter": {"kind": "cut"}, "exit": {"kind": "cut"}}},
{"id": "more", "fromSec": 28, "toSec": 31, "intent": "glide-follow", "data": {
  "lines": [{"words": ["Follow", "for", "more"], "role": "lead", "at": 6}],
  "handle": "@example.creator", "heroAt": 16,
  "pill": {"label": "FOLLOW"},
  "enter": {"kind": "cut"}, "exit": {"kind": "cut"}}}
```

The same data works in Arabic: write the lead-in, the keyword, the box and the pill label in Arabic and keep the handle in Latin. The scene reads right to left, and the handle stays one left-to-right word.

## Avoid

Stop and reconsider if any of these is true.

- A word has blur, scale, a second easing curve or sideways motion (bullets excepted).
- A line reflows, re-centres or shifts when a word, box, card or bullet arrives.
- Two scenes crossfade, a scene fades, a flash or whoosh dresses a cut, or a cut has no low hit.
- A card tilts, floats, scales or animates its own content, or a floating or full-bleed recording replaces the card.
- A second text colour, a shadow on text, a rounded box corner, or more than one box in a scene.
- Anything sits above y 250, below y 1470 or inside the rail (dressings excepted), or a card crosses y 1150 at x beyond 853.
- A follow card shows a clipped handle or lacks the Follow pill, or an ending uses the shared `comment` or `follow`, which draw their header lines in the shared card style.
- A face is recoloured, screened or textured.
- Word timing is tied to recognised word starts instead of the metronome plus line anchors.
- Coordinates were copied from an earlier video instead of composing inside the budget.
- The pill or the tool name is plain text, or a pill scales or springs in.
- Letter-spacing on Arabic, per-character animation of Arabic, or Arabic italic.
