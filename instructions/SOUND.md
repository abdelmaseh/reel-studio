# Sound effects: which, when, how loud

The sound worker's guide. It decides which effect a moment gets, where it lands and how loud the stem sits under the voice. Every effect is synthesized locally from `Sound-Kits/catalog.json` (`Sound-Kits/README.md` lists the recipes and the cue each scene emits); styles carry their own palette in `engine/src/styles/<id>/sound.json`. The assistant cannot hear: it works from these rules, the numbers the tools measure and what the creator reports after playing a named passage.

## Modes and the sweep switch

- A recording's brief: `"sound": "auto"` is the default when the field is missing. It places the chosen style's palette on the scenes' real cues. `"sound": "none"` keeps the whole video free of effects. `"sound": "recipes"` is the old behaviour (one stock cue at every scene start); use it only when the creator asks for exactly that.
- A graphics specification: `"sounds": "auto"` places the palette; `"sounds": "none"` (or no `sounds` key) keeps it silent; a list is explicit authored events.
- Transitions land on a soft low landing or stay silent. Air sweeps (whoosh, swipe) are never placed by default. A creator who explicitly asks for sweeps gets them with `"sweeps": true` beside the brief's `sound` or beside `"sounds": "auto"`: the four landing recipes then play their `-sweep` twins. Never switch it on from your own taste; write the creator's words in the decision.

## What earns a cue

1. Cue only a real state change the viewer can see: a card arrives, a number rolls, a button is pressed, a chapter changes, a result lands. A word being spoken, a camera drift or a caption group changing is not a state change.
2. Land the cue on the spoken onset or on the frame the move settles, never in the middle of a move. Recipes that peak late (`paper-reveal`, `restrained-reveal`, the Grid Glide hits) carry their own lead in the palette so the peak meets the frame.
3. Choose the timbre by the event, then the nearest recipe:

| Event | Timbre | Recipes |
| --- | --- | --- |
| something appears (badge, chip, card, highlight) | a small pop | `soft-pop`, `highlight-swipe`, `paper-reveal` for paper |
| done, confirmed, installed | a short chime after a click | `ui-confirmation` |
| a slam, a stamp, a weighted landing | a soft low impact | `restrained-reveal`, `soft-transition`, `directional-whoosh`, `chapter-shift`, `sub-thud` |
| a screenshot or a capture | one damped click | `ui-click`, `cursor-click` |
| real typing on screen | a short uneven typing burst | `typing-burst` |
| a counter or a rolling number | sparse ticks | `count-tick`, `counter-accent` |
| a wrong answer or a rejected option | one short dull click, never a buzzer that mocks | `ui-click` at a low gain |
| a transition between scenes | a soft low landing or silence | `soft-transition`, `directional-whoosh`, `chapter-shift`, Grid Glide `sub-thump` |

4. Transitions: a soft low landing on the settle frame, or nothing. Sweeps only through the explicit switch above.

## How many

5. Fewer cues than you think. The planner keeps at most one accent per 0.4 s and the higher-priority kind wins; do not fight it by moving cues closer. A calm explainer carries a cue only on real changes, well under one per second; an energetic promo may carry more but still never two inside 0.4 s; Grid Glide carries only its cuts and pills. Silence before a number gives the number weight.
6. Collision priority is fixed: `transition` > `stamp` > `swap` > `click` > `count` > `reveal` > `type`. When two cues share a frame the lower one is dropped and the decision list says so (`density`). Read the dropped list and move a cue only when the picture changes with it.
7. Vary repeats: alternate two recipes of the same timbre for a series of arrivals, and keep event gains between 0.35 and 0.55 so no single cue sets the stem level alone. Grid Glide and One Shot palettes have their own measured gains; do not scale them by hand.

## How loud

8. The mix places the effects stem a fixed distance under the voice peak (`mix.mjs --under`, `editor.mjs render --sfx-under`). Start at 7 for sparse effects, 9 to 10 for dense effects or a stem that carries music, and add 2 whenever the creator says the effects are loud. Judge by the measured stem gain in the mix report, not by the number: one loud cue lowers every cue with it, so quieten that cue's `gain` in the edit instead.
9. Nothing at or after the sign-off. The follow card may carry at most one soft click or chime, and the goodbye needs about one second of clean air before it.
10. A recipe must end before the sign-off frame; `prepare` refuses one that crosses it, so move or drop the cue rather than shortening the goodbye.

## Music and recordings

11. No music by default. When the creator wants a bed, it is their own file or a licensed one; describe it by instruments and tempo, not by genre. Keep it 5 to 8 dB under the effects in the stem, pre-duck it 3 to 5 dB under speech with 0.12 s ramps, and keep it silent under the hook and from the sign-off on.
12. Recorded effects ship only when every file is CC0 with a provenance ledger (`NOTICE.md`); never copy an effect from a paid pack or a video. Everything else is synthesized here.

## What you cannot hear

13. Use the numbers as proxies: cues per minute inside the style's band, the shortest gap, silence at the sign-off, the measured stem gain, the delivered loudness (about -14 LUFS, true peak about -1 dBTP). Then ask the creator to play one named passage on the phone speaker and on earbuds and answer three questions: is the speech clear, are the effects comfortable, does anything need to change. Map the answers to the knobs: too loud → `--under` +2; too many → drop the lowest-priority cues in that passage; dull → raise one landing's `gain`, not the stem. Low Grid Glide hits (under 110 Hz) can vanish on a phone speaker; that is expected, not a fault.
14. Log every rejected effect with `node scripts/review.mjs add --project <slug> --media <file> --at <time> --text <note>` in the audio category, so the next edit starts from what the creator did not want.
