# magazine-interview

## Look

A print magazine alternating navy and cream pages, gold hairlines and folios; Alexandria thin/heavy contrast with Source Serif 4 accents and IBM Plex Mono numerals. Captions follow each page's ink and ground.

## Best for

Interviews, chapters and accurately attributed quotes.

## Layouts and footage

Uses the shared `split` and `takeover` layouts. [MOTION-CHOICES.md](../MOTION-CHOICES.md) records each family's layout support and [PERFORMANCE.md](../PERFORMANCE.md) records presenter picture-in-picture.

## Palette and brand

- **Brand colours:** not applied; the style keeps its own palette.

## Recipe

**Direction:** preserve the speaker's authority and wording

- **Decision:** Choose it for a quote, interview chapter or attributed viewpoint. Identify whose words are being shown and which context makes them accurate.
- **Composition/material:** Use navy or cream pages, gold hairlines and the measured thin/heavy headline contrast. Chapter quotes keep the supplied chapter, quote and attribution; verdict presents supplied scores.
- **Timing/action:** Keep the fixed pilot page choreography, restrained rings and stamp. Count remains split; statement remains over footage.
- **Transition/sound:** Prefer the signature `magazine-flip` between compatible adjacent takeover scenes. This is a director choice: the code preserves authored transitions and does not propose them automatically. Follow its layout and two-scene contract in [MOTION-CHOICES.md](../MOTION-CHOICES.md); sound follows [SOUND.md](../SOUND.md).
- **Application/review:** `chapter-quote` carries title, quote, speaker and role; check all against the source. Review cover overlap and the quote transition if enabled. A shorter paraphrase belongs in a reviewed explanatory label, not quotation marks.

## Style-owned scenes

- **Owned beat:** `verdict`, takeover only in this style: `question`, 2–4 `rows` with label/value/outOf/atFrame, `verdict` and `verdictFrame`. Scores are non-negative and cannot exceed outOf. Row cues and verdict are strictly ordered inside the scene; the template is 150 frames with cues 30/46/62/84.
- **Shared beat:** `chapter-quote` uses the supplied chapter, title, quote, speaker and role. The approved takeover drawing keeps its fixed frame-20 quote cue; optional cover and quoteFrame do not alter that drawing. Existing shared split behavior remains available.
- Library scores are labelled «مثال» and are illustrative; replace them with reviewed creator data.

## Avoid

- Avoid effects that obscure a speaker's face or imply an unspoken emphasis.
- A shorter paraphrase belongs in a reviewed explanatory label, not quotation marks.
