# Authored motion graphics without a recording

Use this route when the creator asks for an animated explanation, map, title sequence or other motion video and has supplied no recording. The studio can create a silent generated base and run authored scenes through the normal editor. It does not need an uploaded source or a made-up transcript. Read [RULES.md](RULES.md), [EDITORIAL.md](EDITORIAL.md) and [MOTION-CHOICES.md](MOTION-CHOICES.md).

Use the chosen style's guide, linked from [STYLES.md](STYLES.md), to decide the visual grammar, [STYLE-LEARNING.md](STYLE-LEARNING.md) for named-reference evidence and its content-specific application, and [ASSET-PRODUCTION.md](ASSET-PRODUCTION.md) for any supporting media. An authored mechanism can use [PROJECT-SCENES.md](PROJECT-SCENES.md) with project-local React code, declared fields and the normal live preview/render/checks. Reference notes alone do not change scene behavior.

## Author and check the specification

Write `Projects/<slug>/graphics-spec.json` with `version: 1`, `id`, one of the registered `style` ids listed in [STYLES.md](STYLES.md) (the graphics route does not read `PROFILE.json` by itself: take the creator's saved fixed style and font from `node scripts/profile.mjs brief` and write them into the spec), `fps` (30, 50 or 60), optional `durationInFrames`, and `scenes`. Scenes use the normal scene schema: `id`, `family`, `fromFrame`, `durationInFrames`, `layout: "takeover"`, `motion`, and `data`. They must cover the whole timeline without gaps or overlapping intervals. Plan readable final holds and meet each family's duration floor.

Copy review is independent of speech. Include `reviewedBy` naming the actual reviewer of the authored copy; graphics mode requires reviewed copy before initialization. Do not record an approval that did not occur. Optional `creator` and endings are authored explicitly; the default has no comment keyword, follow card or sign-off. Preserve only endings applicable to this request. Do not invent narration, pretend that generated silence is a recording, or use literal `kinetic-text` word indices without recorded words.

Start from the [complete illustrative example](examples/idea-to-results.json). Its review attribution concerns the bundled synthetic copy, not approval of a customer's video. It demonstrates messages gathering into a board and a selected result moving into focus; it is not a fixed recipe for every topic.

For scattered messages → one board → one selected result, use the optional `message-board` takeover family described in `MOTION-CHOICES.md`. It carries the same item IDs through gathering and focus with authored frame cues. The example demonstrates this continuous action across twenty seconds with no assets or invented speech. Other registered `motion-concept` choices are indexed in `LIBRARY.md` with their actual mechanisms and limits.

For a countable explainer in the `grid-glide` style (steps, tools or options that each have a real capture), author `glide-chapter`, `glide-card` and `glide-lines` scenes as described in [styles/grid-glide.md](styles/grid-glide.md), and end with `glide-comment` and `glide-follow` when the creator's endings are on. Their frames are relative to the scene start, the captures inside a card are public-local files whose `sha256` and pixel size the scene states, and the optional `watermark` text is whatever you write (or leave it out). Other shared families such as `screens` may sit between them and change by hard cuts; the shared `comment` and `follow` draw their header lines in the shared card style, so this style does not use them.

For a how-to that should play as one unbroken take (open something, put a file in, type a request, choose an option, wait, receive the result), use the `one-shot` style with a single `one-shot` scene as described in [styles/one-shot.md](styles/one-shot.md). Write `"sounds": "auto"` in the graphics specification and the creation command places that style's sound palette on the scene's own cues. `"sounds": "auto"` works the same way for every style (its palette's cues land on the scenes' state changes); write `"sounds": "none"` (or leave the key out) to keep the graphic silent, keep an explicit `sounds` list for authored events, and add `"sweeps": true` beside `"sounds": "auto"` only when the creator explicitly asks for air sweeps ([SOUND.md](SOUND.md)). The scene is derived from the steps you write, so it must last at least as long as the chain: the validator names the exact frame count.

```powershell
node scripts/editor.mjs graphics Projects/<slug>/graphics-spec.json --check
node scripts/editor.mjs graphics Projects/<slug>/graphics-spec.json
node scripts/editor.mjs prepare Projects/<slug>/edit.json
node scripts/review-editor.mjs Projects/<slug>/edit.json
node scripts/editor.mjs render Projects/<slug>/edit.json
```

`--check` validates only and creates no media. The creation command writes a generated silent base, `edit.json` with `contentMode: "graphics"`, `presenter: false`, empty caption words, and an origin record. It never replaces an existing project. After creation edit the existing manifest, preserving manual changes; do not rerun initialization to overwrite it. Open the printed editor URL immediately, keep the server alive, and review meaningful small batches.

## Evidence, assets and geography

Use supplied or appropriately sourced assets and record their provenance in the project. Relative scene-image paths refer to files under `engine/public/`; keep generated project assets in their own untracked folder. A diagram may be illustrative; label it accordingly. Real numbers and places need reviewed sources.

B-roll clips in a graphics project come only from files the creator names. Register each one with `node scripts/clips.mjs add ... --fps <the graphics spec's rate>` (see [EDITING.md](EDITING.md#named-b-roll-clips)) and place it as a full-screen `screens` beat with `look: "broll"`; there is no presenter, so the split layout and the presenter window do not apply.

For a request to highlight regions on a map, verify the map geometry, region names, islands/enclaves and label positions. Keep the same verified map through successive highlights so the viewer sees where each region belongs. `screens` takeover scenes can sequence supplied/generated annotated map images (`steps`, at most six per scene), with another scene for remaining regions and a final combined view. This is a supplied-asset route, not a built-in geographic database. A `route-stops` diagram alone does not establish region borders. Explain and resolve a missing factual asset rather than quietly substituting an inaccurate outline.

## Review and deliver

Use [VISUAL-REVIEW.md](VISUAL-REVIEW.md) for actual motion, readable holds, continuity and factual review. If the creator approved the plan and asked to finish, retain that scope rather than asking for the same approval at every stage.

Create the first project without `--deliver` and review its actual preview. After creative preview review, update the existing validated manifest to delivery purpose, retaining the reviewed copy/reviewer, then prepare again and render normally. `graphics --deliver` can initialize a new already approved project; it does not export a video or overwrite an existing draft.

```powershell
node scripts/editor.mjs render Projects/<slug>/edit.json --deliver
```

Graphics-only work has no presenter motion plan or head review. Applicable plate, layout, safe-zone, media and Instagram checks remain. Inspect the final MP4, copy the verified output into `Outputs/<slug>/`, and write its post descriptions with the social-captions skill. Publishing is a separate action.
