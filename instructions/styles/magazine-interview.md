# magazine-interview

## Look

Navy editorial page, gold rules, clean quote text and speaker identification.

## Best for

Interviews, chapters and accurately attributed quotes.

## Layouts and footage

Uses the shared `split` and `takeover` layouts. [MOTION-CHOICES.md](../MOTION-CHOICES.md) records each family's layout support and [PERFORMANCE.md](../PERFORMANCE.md) records presenter picture-in-picture.

## Palette and brand

- **Brand colours:** not applied; the style keeps its own palette.

## Recipe

**Direction:** preserve the speaker's authority and wording

- **Decision:** Choose it for a quote, interview chapter or attributed viewpoint. Identify whose words are being shown and which context makes them accurate.
- **Composition/material:** Use a navy editorial page, gold rules, clear quote text and speaker identification. Keep the chapter marker secondary. An optional supplied transparent cover subject uses the exact asset contract in the Style-owned scenes section below.
- **Timing/action:** Establish the chapter/speaker, reveal the exact quote at its real cue or authored reading moment, then hold attribution and words together. Give the voice room when the face carries the statement.
- **Transition/sound:** Use a restrained chapter/rule change or a deliberate portrait-to-quote relationship. Avoid effects that obscure a speaker's face or imply an unspoken emphasis.
- **Application/review:** `chapter-quote` carries title, quote, speaker and role; check all against the source. Review cover overlap and the quote transition if enabled. A shorter paraphrase belongs in a reviewed explanatory label, not quotation marks.

## Style-owned scenes

No scene family is reserved for this style. The beats below are shared families that make it eligible for automatic recommendation.

- **Semantic beat:** `chapter-quote`; use the speaker's actual words and verified name/role.
- **Optional cover, off by default:** supply `data.cover` only for a `takeover` scene. The existing title sits behind your provided transparent PNG until `quoteFrame`, then the normal quote appears. The PNG keeps its original colours and proportions; no automatic background mask or depth generation is included.
- `cover.foreground` needs a public-local PNG `src`, its exact `sha256`, `width` and `height` (up to 4096 each). Preparation checks the bytes, dimensions, alpha channel, real transparency and visible pixels. An opaque or fully empty image is refused.
- `cover.box` is `{x,y,width,height}` relative to the safe scene canvas. Keep `x + width <= 1`, `y >= 0.05` and `y + height <= 0.82` so the chapter label and speaker attribution stay clear. Use a positive `quoteFrame` inside the scene. Review the supplied subject and title overlap before delivery. Leaving out `cover` preserves the ordinary chapter/quote behaviour.

## Avoid

- Avoid effects that obscure a speaker's face or imply an unspoken emphasis.
- A shorter paraphrase belongs in a reviewed explanatory label, not quotation marks.
