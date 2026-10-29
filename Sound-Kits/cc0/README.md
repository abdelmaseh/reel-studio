# Bundled CC0 recordings

`ledger.json` is the provenance ledger of the 28 short recorded sounds in this folder (0.94 MB as 48 kHz WAV; the budget is 8 MB). For every file it records where it came from, the source size and the SHA-256 of the file as shipped. A sound is added only with its ledger entry.

Every file is CC0 1.0 (public domain, no credit required). None is music, an air sweep (whoosh, swipe, riser) or an error buzzer: `instructions/SOUND.md` forbids them and `scripts/lib/cc0-sounds.mjs` refuses a ledger entry whose source file name says so.

## Kinds and what they are for

| kind | files | event it fits (nearest synthesized recipes) |
| --- | --- | --- |
| click | `click-minimal`, `click-mechanical`, `click-snap`, `click-tiny`, `click-metal` | one damped press: a capture, a button (`ui-click`, `cursor-click`) |
| pop | `pop-minimal`, `pop-rubber`, `pop-organic`, `pop-zen`, `pop-select` | something small appears (`soft-pop`, `highlight-swipe`) |
| chime | `chime-minimal`, `chime-zen`, `chime-bright`, `chime-soft` | done, confirmed (`ui-confirmation`) |
| tick | `tick-minimal`, `tick-1`, `tick-2`, `tick-3` | a rolling number, sparse (`count-tick`, `counter-accent`) |
| type | `type-minimal`, `type-mechanical`, `type-organic` | real typing on screen, a short uneven burst (`typing-burst`) |
| reject | `reject-dull` | a wrong answer: one short dull click, low gain |
| landing | `landing-cinematic`, `landing-soft-heavy`, `landing-soft-medium`, `landing-wood`, `landing-plank` | a soft low landing: a stamp, a heavy card, a chapter (`soft-transition`, `chapter-shift`) |
| paper | `paper-flip` | paper and card foley (`paper-reveal`) |

## Files

| id | kind | length | use |
| --- | --- | ---: | --- |
| `click-minimal` | click | 0.15 s | One dry damped press: a screenshot, a capture, a pressed button. |
| `click-mechanical` | click | 0.16 s | A firmer mechanical press for a real product button. |
| `click-snap` | click | 0.18 s | A short soft snap when something locks into place. |
| `click-tiny` | click | 0.02 s | A very short tick-like click (about 20 ms); stack it under a bigger sound or use it alone at low gain. |
| `click-metal` | click | 0.45 s | A small metal latch click for a capture or a confirmed selection. |
| `pop-minimal` | pop | 0.34 s | A small pop for a badge, chip or sticker that appears. |
| `pop-rubber` | pop | 0.31 s | A rounder pop for a card or highlight that appears. |
| `pop-organic` | pop | 0.29 s | A warmer pop for a hand-made element (paper, tape, sticker). |
| `pop-zen` | pop | 0.26 s | A light pop with a soft tail for a calm reveal. |
| `pop-select` | pop | 0.06 s | A tiny pop (about 60 ms) for a chip or a list item that appears. |
| `chime-minimal` | chime | 0.59 s | A short chime after a click: done, confirmed, installed. |
| `chime-zen` | chime | 0.57 s | A softer chime for a calm result. |
| `chime-bright` | chime | 0.29 s | A short bright confirmation (about 0.3 s). |
| `chime-soft` | chime | 0.32 s | A short soft confirmation (about 0.3 s). |
| `tick-minimal` | tick | 0.20 s | One step of a counter or a progress bar. |
| `tick-1` | tick | 0.04 s | A short counter tick. |
| `tick-2` | tick | 0.02 s | A shorter, higher counter tick; alternate with tick-1. |
| `tick-3` | tick | 0.06 s | A third counter tick for variation. |
| `type-minimal` | type | 0.09 s | One key tap; vary the pick and the gain for a short uneven burst. |
| `type-mechanical` | type | 0.09 s | A firmer key tap for a code or terminal line. |
| `type-organic` | type | 0.10 s | A softer key tap for a chat or search box. |
| `reject-dull` | reject | 0.26 s | A wrong answer or a rejected option: one short dull click at a low gain. |
| `landing-cinematic` | landing | 0.58 s | A soft low landing for a stamp or a heavy card (about 0.6 s). |
| `landing-soft-heavy` | landing | 0.53 s | A soft heavy thud: a weighted landing or a chapter change. |
| `landing-soft-medium` | landing | 0.12 s | A lighter soft thud for a card that settles. |
| `landing-wood` | landing | 0.31 s | A dry wooden thud for a stamp or a block that drops. |
| `landing-plank` | landing | 0.78 s | A hollow plank knock for a board or a panel that lands. |
| `paper-flip` | paper | 0.21 s | A single page turn for the Arabic page-turn move. Paper foley, not a sweep; drop it if you treat page turns as sweeps. |

## How a file is used

Each file is a catalog recipe `cc0-<id>` with one hit `{"sound": "sample:<id>"}` at t=0 and a hit gain of 0.3, like the other short recipes. `scripts/sfx.mjs` reads the WAV, resamples it to 48 kHz when needed and scales its peak to 0.7, so the same gain means the same level for every file. A palette or an edit names the recipe exactly as it names `soft-pop`. Rules, caps and loudness stay those of `instructions/SOUND.md`. No style palette names a `cc0-*` recipe until the set has been auditioned on a phone speaker and earbuds.

## Add or replace a file (after the owner's yes)

1. Add the entry to `ledger.json` (CC0 sources only), then `node scripts/cc0-sounds.mjs urls` prints the approval table: file, exact url, exact size, licence.
2. Download the approved files into a new empty scratch folder outside the studio, each saved under the `saveAs` name of the table (the id plus the source extension). The size of each download must match the table exactly.
3. `node scripts/cc0-sounds.mjs convert --from <scratch folder>` makes `Sound-Kits/cc0/<id>.wav` (48 kHz, 16-bit, leading silence trimmed, no loudness change).
4. `node scripts/cc0-sounds.mjs stamp` writes sha256, bytes, seconds and channels into `ledger.json`; `node scripts/cc0-sounds.mjs check` must report no problem.
5. `node scripts/cc0-sounds.mjs catalog --write` adds the `cc0-*` recipe to `Sound-Kits/catalog.json`; list the file in the table above.
6. Audition it (phone speaker and earbuds) before a palette uses it; drop any file from the ledger that sounds wrong.
