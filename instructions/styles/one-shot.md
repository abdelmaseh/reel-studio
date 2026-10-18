# one-shot

Arabic label: ونشوت. English label: One shot. Introduced in 3.0.0.

A tutorial told in one unbroken take. There is no cut and no fade: every step opens from something that was already on screen, so the viewer follows one object from the first frame to the last, and the last frame is the first frame, so the video loops.

**The sentence that generates the style:** each world is built from what the world before it ended with. A button grows until it is the screen, a file becomes part of the sentence that is typed, a send button opens a circle that is the next page, and when the work is done the camera pulls back to show that it was all a laptop and the reel is on the phone. If a step appears with a fade or a wipe instead of growing out of the one before it, it is not this style.

Read [EDITORIAL.md](../EDITORIAL.md) first. Author the video with the graphics route in [GRAPHICS.md](../GRAPHICS.md), which needs no recording. Shared rules (choosing a style, endings) live in [STYLES.md](../STYLES.md) and bespoke scenes that no style covers belong to [PROJECT-SCENES.md](../PROJECT-SCENES.md).

## Look

- Three colours that take turns: a warm cream home page, near-black worlds with white words and a lime accent, and lime worlds with ink words. Cards are white and rounded, and the cursor is a white arrow with an ink outline that presses, drags and clicks.
- Every step has the same header: a numbered circle whose digit rolls to the next number, and a two-line title whose second line takes the accent. The home page lists the same steps as rows and ends in one dark button.
- Motion is springs with a small overshoot for things that arrive, eased glides for the cursor and exponential curves for the camera. Words rise out of a mask one at a time. Motion blur appears only while the camera moves fast.
- Sound is soft wind for every move, a low landing when a world arrives, clicks for presses and quiet ticks and pops for small changes.

## Best for

- A how-to with screen steps (open, put something in, type a request, choose an option, wait, receive the result) told by a voice or by authored copy. "Three steps to ..." is the natural shape.
- Faceless videos: the chain is the performer. Not for opinion, comparison tables or a talking presenter. If there is no object that can travel from step to step, choose another style.

## Layouts and footage

- The family `one-shot` is a `takeover` scene that fills the whole frame. It exists only in this style and the manifest refuses it in any other style. It can be the whole video (the graphics route) or one scene of a longer edit; the first and last frame are its home page either way.
- Recorded captions never draw over it. Picture-in-picture is not part of this style, and no footage is placed inside it: the reel in the finale is a drawn stand-in with the words you give it, not a recording.
- The style lays out its worlds inside the Instagram Reels safe area, including the action rail on the right below the middle of the frame, with one exception that depends on your copy: the closing words are a column that grows with the headline, the sub and the platforms, and the validator refuses a closing that would end below the safe area (the room is given under Copy). The delivery safe-zone gate still checks the real render: fix any finding instead of assuming a valid chain passes. Titles, rows and figures shrink to fit instead of wrapping, but short copy reads better: keep every title and row to a few words. The closing headline does not shrink: its words wrap, and a long word takes a line of its own.
- Author at 30, 50 or 60 fps. All times are derived in seconds, so only `durationInFrames` changes with the frame rate. The scene must last at least as long as the chain; the validator says exactly how many frames. Frames beyond that hold the home page.

## Palette and brand

- Canvas `#F3EEE3`, ink `#0E1117`, accent `#C8FF4A`, card `#FFFFFF`. Brand colours are not applied: relay the plan notice in one line. The optional `accent` field of the scene replaces the lime for one video; choose a light saturated colour that dark ink text stays readable on.
- Fonts: `Noto Kufi Arabic` for titles, `Cairo` for field text and rows, `Readex Pro` for Latin names. A creator font preference replaces all three.
- Without a digits choice the style numbers its steps, rows and figures in Arabic-Indic (٣) and draws the copy as written. When the creator fixes the digits (`latin` or `arabic-indic`) every figure, step circle, home row, percent and copy line follows that choice.

## Recipe

**Direction:** a how-to that never cuts

- **Decision:** Choose it when the message is a short sequence of things a person does on a screen and something real changes at each step. Two to four steps work best; the home page has a row for each.
  - **Fit check.** Name the object that travels (a file, a prompt, a number) and the result it becomes. If you cannot, say so when you choose the style, before writing the beats, and offer another style.
- **Composition/material:** Write the steps first and the copy second.
  - **Steps.** `drop` puts a file into a place, `field` types a sentence, `toggle` switches options on, `stat` counts up one number, and `work` shows jobs finishing. Pick only what the tutorial really does; never add a step to fill time.
  - **Colour grammar.** Worlds alternate between dark (`drop`, `field`, `stat`) and accent (`toggle`, `work`). The first step is dark. A `drop` is always followed by a `field`, and the file stays in the sentence as a token. Two steps of the same colour cannot follow each other (except that pair): put the other colour between them. `work` is always last, and a `toggle` is never last.
  - **Copy.** Every title is two short lines: the action, then its object. A typed sentence is at most six words (22 characters after a file, 34 otherwise). File names and tool names stay Latin. Every number and name on screen comes from the creator or a source; never invent a figure for a `stat`.
  - **Closing words.** The headline, the sub and the platforms share one column beside the phone that grows down from y = 832 and must end no lower than y = 1458 (the platform's own interface starts at 1470). The headline wraps: two words share a line only when together they have about six letters or fewer, so a headline of four ordinary words takes four lines. The sub wraps at about 22 characters (earlier with wide letters such as م ع ه س ش), so keep it to 20 for one line. The three usual platforms (Instagram, TikTok, Shorts) take two rows. With two rows there is room for a three-line headline with a two-line sub, or a four-line headline with a one-line sub; anything taller is refused with what to shorten.
- **Timing/action:** The take is timed on a half-second beat, so you do not write times. The chain lasts about 2.5 s for the home page and the first swallow, 3.5 to 5 s per step, 1.5 s for the reel moment and 5 s for the pull back, the swipe and the dive home. The common chain (`drop`, `field`, `work`) is 20 s, which is 600 frames at 30 fps.
  - **Order of one step.** The header pops, the title rises, the object appears, the cursor does the action, and only then does the bridge begin.
  - **Reading time.** Titles stay long enough to read, and typed words arrive about three per second. Do not shorten a chain to fit a duration: drop a step instead.
- **Transition/sound:** Only these bridges exist, all drawn by the style. Effects follow [SOUND.md](../SOUND.md).
  - **Swallow.** The home button grows until its colour fills the screen and the first world is that colour.
  - **Morph.** The folder tile becomes the text field and the file travels inside it. The progress card becomes the reel.
  - **Circle.** The send button, the last switch or the dot under a number opens a circle that carries the next world.
  - **Pull back.** The reel fills the screen, then the camera pulls back to a laptop and a phone, the phone swipes to the home page and the camera dives into it: the first frame again.
  - **Never** crossfade, wipe, flip or cut between worlds, and never add a whoosh by hand. Put `"sounds": "auto"` in the graphics specification: it places the style's palette from the scene's own cues (`air-rise` on a swallow, circle or dive, `air-pass` on a morph, pull back or swipe, `sub-thud` when the file lands, `cursor-click` on presses, `ui-click` on typing and counting, `soft-pop` on small arrivals).
- **Application/review:** Build and check in this order.
  1. Write the specification, run `node scripts/editor.mjs graphics <spec> --check`, then create, prepare and open the editor as the graphics route describes. A chain that breaks the colour grammar or is too short is refused with the reason.
  2. Render stills at the first and last frame (they must be identical), just before and after every bridge, at the moment each typed sentence is complete and on the reel moment, in Arabic copy with digits.
  3. Check that no word is clipped, the typed sentence stays beside the file token on one line and each title is readable for at least two seconds. Run `node scripts/safe-check.mjs --comp PreparedEdit --props-file Projects/<slug>/prepared/props.json`. A finding in the last seconds means the closing words are too tall, even when the copy looks short (a four-word headline takes four lines): shorten the headline, shorten the sub to one line or drop a platform, using the room under Copy. A finding earlier means a title, row or figure is too long for its box.
  4. Render the real video, review its stills and ask the creator to play it with sound: motion, sound and the loop seam are judged on the MP4, following [VISUAL-REVIEW.md](../VISUAL-REVIEW.md). Technical checks are not creative acceptance.

## Style-owned scenes

The family below is registered once and is valid only with `style: "one-shot"`. Read `engine/src/styles/one-shot/scenes/schema.ts` for the exact limits. The scene has `layout: "takeover"` and carries `motion` only for manifest compatibility.

| Family | Purpose | Data |
| --- | --- | --- |
| `one-shot` | The whole chain in one scene | `brand`, `intro` (`top`, `bottom`, `sub`, `start`), `steps` (1 to 4), `result.words` (4 to 6), `closing` (`top`, `sub`, `platforms`), optional `accent` |

Each entry of `steps` has a `kind` and a two-line `title` (`top`, `bottom`, 26 characters each):

| Step kind | Colour | Fields | Notes |
| --- | --- | --- | --- |
| `drop` | dark | `item` (file name), `target` (place name) | Must be followed by a `field`. The file becomes a token inside the field. |
| `field` | dark | `text` (typed word by word), `placeholder` | The send button opens the next world. |
| `toggle` | accent | `options` (1 to 3, each `label` and `on`) | At least one option is on. The cursor switches the ones that are on. Never last. |
| `stat` | dark | `value`, `decimals` (0 to 2), `unit`, `label` | The number counts up from zero. |
| `work` | accent | `jobs` (2 to 4), optional `file` | Last step only. The card becomes the reel. `file` defaults to the dropped file. |

The scene's cues for sound are derived from the chain (clicks, typed words, bridges, finished jobs, caption ticks), so there are no cue fields to write. The first frame and the last frame are the same home page.

## Avoid

- A bridge that fades, wipes or cuts instead of growing out of an object that was already on screen.
- A step that does not change anything real, added to lengthen the video.
- A typed sentence longer than the field allows, or a title that wraps to a third line.
- A figure, file or tool name on screen that did not come from the creator or a source.
- Two steps of the same colour in a row, a `toggle` as the last step, or a `work` before the last step.
- Real footage or a screenshot placed in the reel: this style draws a stand-in. Use a style that supports captures for that.
- Hand-placed whooshes or a music bed over the take.
