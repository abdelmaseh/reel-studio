# Styles

This edition's styles are driven by `node scripts/editor.mjs` and rendered by `PreparedEdit`. When the style is automatic, the manager, as creative director, chooses one per video by judgement, from the "Best for" column below and the style's own fit rule, before the beats are written, and tells the creator why in one plain line. `editor.mjs recommend` ranks styles by points and is only a second opinion. Explicit and profile-fixed choices always win. Use `EDITORIAL.md` to plan the idea and `MOTION-CHOICES.md` to check real family/layout contracts. A direction is not a fixed montage.

Every style has its own guide, `styles/<id>.md`, linked from the table: Look, Best for, Layouts and footage, Palette and brand, Recipe, Style-owned scenes and Avoid. Read the chosen style's guide before planning its scenes; this page holds the rules every style shares. To learn from named finished references, use [STYLE-LEARNING.md](STYLE-LEARNING.md): evidence stays in the current project's Style DNA and transfers into its actual scene plan/data/code. It does not add an unsupported style ID or change the creator's saved choices. [PROJECT-SCENES.md](PROJECT-SCENES.md) supports project-local behavior beyond a shipped family's mechanism. Adding or promoting a global style is studio maintenance and follows [STYLE-AUTHORING.md](STYLE-AUTHORING.md).

## Style table

Generated from the style registry (`engine/src/styles/registry.ts`) by `node scripts/style-docs.mjs`. Edit the registry, never this block.

<!-- styles:table:start -->
| Style | Label | Best for | Brand colours | Own scenes |
| --- | --- | --- | --- | --- |
| <a id="section-deck"></a>[`section-deck`](styles/section-deck.md) | Section deck · خطوات منظمة | explainer, tutorial, comparison | profile colours | none |
| <a id="kinetic-paper"></a>[`kinetic-paper`](styles/kinetic-paper.md) | Kinetic paper · ورق متحرك | explainer, comparison, tutorial | own palette | none |
| <a id="calligraphic-receipts"></a>[`calligraphic-receipts`](styles/calligraphic-receipts.md) | Calligraphic receipts · أدلة وأرقام | case-study, story, opinion | own palette | `claim-proof` |
| <a id="paper-collage"></a>[`paper-collage`](styles/paper-collage.md) | Paper collage · كولاج | story, comparison, case-study | own palette | none |
| <a id="liquid-glass"></a>[`liquid-glass`](styles/liquid-glass.md) | Liquid glass · زجاج مضيء | explainer, tutorial, comparison | own palette | none |
| <a id="magazine-interview"></a>[`magazine-interview`](styles/magazine-interview.md) | Magazine interview · مجلة | opinion, case-study, story | own palette | `verdict` |
| <a id="grid-glide"></a>[`grid-glide`](styles/grid-glide.md) | Grid glide · كلمات وكروت | explainer, tutorial, comparison | own palette | `glide-chapter`, `glide-card`, `glide-lines`, `glide-comment`, `glide-follow` |
| <a id="one-shot"></a>[`one-shot`](styles/one-shot.md) | One shot · ونشوت | tutorial, explainer | own palette | `one-shot` |
| <a id="cartoon"></a>[`cartoon`](styles/cartoon.md) | Cartoon · كارتون | explainer, tutorial, comparison | own palette | `cartoon`, `cartoon-ending` |
| <a id="documentary"></a>[`documentary`](styles/documentary.md) | Documentary · وثائقي | explainer, case-study, story | own palette | `map-route`, `map-focus`, `cutout-card` |
| <a id="layered-speaker"></a>[`layered-speaker`](styles/layered-speaker.md) | Layered speaker · حوالين المتكلم | opinion, story, explainer | own palette | `layered-speaker` |
<!-- styles:table:end -->

## Choosing a style

Apply the current request's delegated choices or directed overrides through [PRODUCTION-MANAGER.md](PRODUCTION-MANAGER.md). Preserve real review requirements and existing approvals; do not repeat settled aesthetic decisions.

**section-deck** was refined on real footage first and are the proven styles. Every other style is newer: every edit still needs the creator's own creative approval, and a newer style that keeps its own palette adds a plan notice that brand colours do not apply. For a newer style always show the fast preview (`EDITING.md` step 5) first. If it shows clipped text, a broken layout or an unreadable frame, say so in one line and offer a proven style instead. Never deliver a style whose preview failed.

## Looks

A look is a finish over the whole picture, not a style. It is the root key `look` of the edit manifest and works over any style:

| `look` | What it does |
| --- | --- |
| `{"kind":"riso"}` | Two-ink print: the footage and the scenes are separated into two inks with grain, a few pixels of plate misregistration and warm paper. Optional `inks`: two different `#RRGGBB` colours, the first carries lines and shadows, the second the warm tones (default blue and pink); the editor refuses a pair that is too close or too pale to read |
| `{"kind":"blueprint"}` | Blue paper, white line work along every edge, a fine grid and drawing marks without any words or numbers |
| `{"kind":"film"}` | The picture keeps its colours; a fine grain that changes every frame and slightly darker corners are laid over it. No options |
| `{"kind":"paper"}` | The picture printed on a sheet: a still paper texture multiplied over it at half strength, so skin and type stay natural. No options |

`riso` and `blueprint` recolour the footage and the scenes, the presenter included, so do not offer them when profile brand colours or natural skin tone must stay. `film` and `paper` keep the colours and only add one layer over the picture; paper can only darken. Review stills: grain and thin line work eat small text. Captions, transition overlays and sound are not filtered and are drawn on top; under `riso` and `blueprint` a caption that has no backing of its own (the minimal shape, and the transparent pills of `calligraphic-receipts` and `magazine-interview`) is drawn on a chip in the look's colours, so every caption stays readable; `film` and `paper` need no chip. Set it in the editor's «المظهر» tab, or put the same `look` object in the brief when the creator asks for it before planning; the planner copies it to the manifest. `riso` and `blueprint` add roughly a third of a second to each rendered frame and `film` about 0.12 to 0.18 s; `paper` costs a few seconds once, on the first frame. A look is never a saved preference. The backdrops `girih`, `sunburst` and `paper` are not looks: they are the `backdrop` option of an `arabic-type` scene ([MOTION-CHOICES.md](MOTION-CHOICES.md)). The `paper` backdrop is a light grain over the style's own ground and is barely visible on dark styles.

## Recipes

The Recipe section of each guide turns that style's visual grammar into choices for new content. It does not add families, data keys, transitions or palette controls to the runtime; [MOTION-CHOICES.md](MOTION-CHOICES.md) records the scene contracts. Read [EDITORIAL.md](EDITORIAL.md) first.

Across all directions, identify the phrase's function, choose one dominant action, retain the relevant object's identity and give its resolved state time to be understood. Use source-word cues for recordings and authored reading cues for graphics. Adapt frame counts, density and presenter use to the material. A motion recipe is a decision system, not a quota of effects or seconds.

## Semantic scenes

The original six semantic families support `split` or `takeover`; their default is `takeover`. `kinetic-text` and `evidence-wipe` also support both; `motion-concept` is takeover-only. See `MOTION-CHOICES.md` for data contracts and `GRAPHICS.md` for source-free authoring. Reveal times are integer frames relative to the scene, authored from reviewed speech. They must be ordered and inside the scene. Read `engine/src/creative-kit/semantic/schema.ts` for the exact editable data contracts and add a beat using its family as `intent`. The live editor includes editable templates for every family.

| Family | Inputs |
| --- | --- |
| `motion-concept` | `{concept, config}` selects a registered concept schema; takeover only and its fps-scaled minimum duration. Inspect the current library. |
| `kinetic-text` | Literal recorded `sourceIndices`, language, entrance and optional emphasis; no synthetic transcript. |
| `evidence-wipe` | Supplied before/after images with exact dimensions, labels, reveal frame/duration and direction. |
| `token-lens` | Heading, 1–3 labelled groups of 1–6 pieces, a real selected group/piece and a footer. This is illustrative grouping unless actual tokenizer results are supplied. |
| `meter-receipt` | Two values on the same positive maximum, unit and real source label. |
| `ticket-offer` | Real invitation/offer label, value, detail, reveal frame and conditions. |
| `comment-stack` | Up to three attributed questions, reveal frames and the approved prompt/keyword. |
| `chapter-quote` | Chapter, title, exact quote, speaker, role and quote reveal frame. |
| `route-stops` | Two to four stops with label, detail, reveal frame and optional public-local image. |

Schema limits do not guarantee font fit. Review real rendered stills before delivery; unfit text fails rather than disappearing or being clipped. Keep recorded wording intact and adapt the layout with the creator.

A scene family reserved for one style appears in the table's Own scenes column, and that style's guide documents its data contract, timing rules and limits.

## Brand colours

- Only the styles marked `profile colours` in the style table take the profile's brand colours. Every other style keeps its own palette; relay the plan notice in one line (for example: "الستايل ده بيفضل بألوانه هو").
- `PROFILE.json` `brand.primary` and `brand.accent` are required; `background` and `text` may be `null` to keep the style's own.
- The planner keeps the background exactly and adjusts ink and highlight lightness in fixed steps until every text pair reaches 4.5:1 contrast. If a colour cannot be made readable, that part of the video uses the style's own colours.
- The plan result lists what changed in `notices`; tell the creator in one line each (for example: "ظبطت درجة لون التمييز شوية علشان الكلام يبان").
- Colours paint graphics only; the presenter is never recoloured.

## Endings

Only the parts that are on for this video appear, always in this order:

| Part | Scene | On when |
| --- | --- | --- |
| Comment CTA | `comment` (or `creator-cta`; `glide-comment` in `grid-glide`) with `keyword` = this video's keyword | the brief's `creator.ending.cta` is a keyword |
| Follow card | `follow` (or `creator-cta`; `glide-follow` in `grid-glide`) with `handle` = the profile handle | `creator.ending.followCard` is true |
| Recorded sign-off | no scene; every scene ends before it | the profile has `signOff` and it is spoken in this recording |

Every style except Grid Glide draws the comment card and the follow card with the same scene families in its own register: the style's palette, type, card shapes and geometry, with the brand palette when the style takes one and the profile has one. The follow card shows the complete handle (up to @ + 30 characters) and a Follow button in the highlight colour; text that cannot fit makes the render fail instead of being cut. Grid Glide is the exception: it draws its own `glide-comment` (the keyword as the hero word) and `glide-follow` (the complete handle as the hero word above a Follow pill), because the shared scenes show fixed English header lines. The delivery check treats each as the scene it replaces, so either pair passes, and a plan in Grid Glide that uses the shared pair carries a notice. A `creator-cta` scene carries the keyword and the handle together, and its follow and click moments must come in that order inside the scene.

## Screen-recording reels

- Set the brief's `sourceKind` to `"screen"` when the source is a screen recording. The face check and the presenter motion check are then exempt and `screen-recording` beats are allowed.
- A cartoon video sets `sourceKind` to `"cartoon"`: the same exemptions apply because the recorded picture is never shown, and only the cartoon scenes may cover the timeline; see [styles/cartoon.md](styles/cartoon.md).
- A `screen-recording` beat shows the recording in the Instagram safe area (1080 x 1220 from y 250). Its data holds:
  - `keys`: camera keys `{atFrame, focus:{x,y,width,height}, zoom, moveFrames}` in frames from the start of the beat; the first key starts at 0; `moveFrames` 0 is a cut, otherwise the move eases in over that many frames.
  - `clicks`: `{atFrame, x, y}` where the recording's own pointer clicks (normalised 0–1 recording coordinates); a ring ripple lands on each.
  - `callouts`: `{atFrame, untilFrame, kind: "rect" | "circle", rect}` pinned to the recording, drawn in the highlight colour.
- Pick focus rectangles from stills of the recording. Take click points and times only from frames where the recording's own pointer visibly presses; otherwise leave the click out. The planner refuses keys that enlarge the recording more than 1.25x (text turns soft) and callouts that land outside the safe zone.
- A screen capture inside a presenter video is a different tool: the `screen-focus` scene family with its own capture file.

## B-roll availability

The B-roll look of `screens` works in every style except `cartoon`, `one-shot` and `grid-glide`, which draw their own screen. The presenter window over a B-roll takeover scene needs a style whose `pip` policy allows it (see [PERFORMANCE.md](PERFORMANCE.md)).

## Select, adapt and prove the direction

Recommend a direction by the message's dominant function and source needs, preserving an explicit or saved fixed choice. Compare the same representative passage when alternatives remain consequential. Implement the relevant decisions in actual scene data/code and asset placement, then review through [VISUAL-REVIEW.md](VISUAL-REVIEW.md). A matching palette alone does not show style fidelity, and a successful technical gate does not establish creative acceptance.
