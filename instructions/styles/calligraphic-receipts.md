# calligraphic-receipts

## Look

Warm ruled parchment, Aref Ruqaa claims and dry rust brush strokes paired with thermal receipts, Noto Naskh Arabic labels and IBM Plex Mono amounts. Torn parchment caption slips sit over footage.

## Best for

Case studies, stories and opinions that lean on evidence and numbers.

## Layouts and footage

Uses the shared `split` and `takeover` layouts. [MOTION-CHOICES.md](../MOTION-CHOICES.md) records each family's layout support and [PERFORMANCE.md](../PERFORMANCE.md) records presenter picture-in-picture.

## Palette and brand

- **Brand colours:** not applied.

## Recipe

**Direction:** connect the claim to its proof

- **Decision:** Choose it for evidence-led stories, claims and measured results. If evidence is missing, show a clearly labelled illustration or resolve the gap instead of inventing a receipt.
- **Composition/material:** Pair measured Ruqaa baselines and rust brush rules with a torn thermal receipt. claim-proof carries the supplied claim and two rows; meter-receipt retains units and source.
- **Timing/action:** Keep the fixed common-family choreography; claim-proof uses its explicit claimFrame, receiptFrame and totalFrame. The receipt must resolve and hold for at least 0.6 seconds.
- **Transition/sound:** Prefer the signature `paper-pull` between compatible adjacent takeover scenes. This is a director choice: the code preserves authored transitions and does not propose them automatically. Follow its layout and two-scene contract in [MOTION-CHOICES.md](../MOTION-CHOICES.md); sound follows [SOUND.md](../SOUND.md).
- **Application/review:** `proof`, `meter-receipt` or supplied evidence assets may fit, subject to their contracts. Confirm units, denominators, attribution, date/conditions and source legibility. A stylish receipt is not proof of a factual result.

## Style-owned scenes

- **Owned beat:** `claim-proof`, takeover only in this style: 1–4 whole claim words, keyIndex, two labelled numeric rows, diff, unit, note and claimFrame/receiptFrame/totalFrame. The supplied diff must equal the absolute row difference; values have at most two decimals. Receipt follows claim, total follows receipt by at least 24 frames, and animation plus a 0.6-second resolved hold must fit. The default template uses 4/14/54 and at least 120 frames.
- **Shared beat:** `meter-receipt` compares supplied values and their maximum, unit and source.
- Library amounts are labelled «مثال» and are illustrative. Numeric edits stay buffered until the complete data object validates; the editor never replaces a supplied diff automatically.

## Avoid

- If evidence is missing, show a clearly labelled illustration or resolve the gap instead of inventing a receipt.
- Let the source/value relationship dominate; a decorative stamp should never imply authenticity.
- A stylish receipt is not proof of a factual result.
