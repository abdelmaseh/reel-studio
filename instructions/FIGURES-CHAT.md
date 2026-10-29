# Figures and chat scenes

These generic families use takeover layout in any registered style. Copy and numbers must come from the creator or reviewed source. Illustrative previews are demonstrations, not evidence of a result or a real customer exchange.

## Figures

Use family figures with data:
- {variant:"counter",value:42,from:0,label:"Illustrative quantity",unit:"items"} for an eased count.
- {variant:"slot",value:42} for digit reels stopping from right to left. Values and optional from are non-negative integers, at most nine digits.
- {variant:"bars",bars:[{label:"A",value:20},{label:"B",value:42}],max:50} for one to six bars on a shared zero-based scale, ordered right to left. max is optional; it cannot be below any value.
- {variant:"ring",value:42,max:100,unit:"of the supplied total"} for an arc showing value/max. max is required and positive, and value stays between zero and max.

All variants accept optional label and unit. Unit is separate from the number to keep Arabic direction stable. A ring does not invent a percent sign or an assumed denominator. Keep the source and measurement basis in the editorial plan. The video's digits preference applies to numbers and Arabic labels. Allow animation and a final hold; timing validation scales with fps.

## Chat thread

Use family chat-thread and data {variant:"bubbles",title:"Illustrative exchange",messages:[{from:"them",text:"Authored question",at:24},{from:"me",text:"Authored answer",at:65}]}.

Variants: bubbles, typing, notifications. Optional app and title are authored labels; no service branding, account or sender identity is generated. One to eight messages are required. Each Arabic message remains joined. me appears on the right and them on the left. Notifications retain the latest five cards.

at is a scene-local frame, not seconds. Explicit at values strictly increase. When omitted, cues are generated deterministically with 1.35 seconds between messages; typing starts its first message after 0.8 seconds and shows three dots for 0.8 seconds before each bubble. Leave at least 0.5 seconds after the last message. The validator refuses scenes that cut the choreography short.

## Sticker

Figures, chat-thread and arabic-type accept one optional `sticker: {kind, id, at?}` in their data.
- `kind` is `lottie` (20 animated icons) or `emoji` (19 animated emoji and 20 stills). `id` comes from the table in `engine/src/creative-kit/stickers.ts`, which also holds each sticker's Arabic label; an unknown id is refused. The files and licences are listed in `third-party/icons/README.md` and `third-party/emoji/README.md`.
- `at` is a scene-local frame (default 0), like the other cues of these scenes. It must be before the scene's last frame.
- The sticker sits in a fixed 160 px spot inside the safe zone: the top right corner of figures and chat-thread, above the text of arabic-type. The safe-zone probe sees it.
- Animated icons play once at their own speed and hold their last frame; animated emoji loop. The black icons turn white on a dark style; colour stickers never change.
- A sticker is decoration that matches authored copy: a check for a step the creator confirmed, a chart beside a supplied figure. It never stands for a claim, a brand or a reaction the creator did not make. `notification` animates into a crossed-out bell, so it means "mute", not "new alert".

## Editor and delivery

Both families appear in the scene picker with editable data and replaceable sample copy. Change variant inside the data form. Replace every template label/message and the number 987654 before delivery. The sample-number guard covers figures value, from, max and every bars value. Sample-text checks ignore structural variant/from choices.

Numeric input supports up to six decimal places. Greater precision is refused instead of silently rounded. Slot reels keep leading zero columns when counting down from a longer supplied number.

Chat bubbles collapse repeated spaces and line breaks to ordinary word spacing, matching their text measurement. Notifications use the shared fitted text layout.
