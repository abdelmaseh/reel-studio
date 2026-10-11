---
name: social-captions
description: Write and check the post description, the text published under a finished Reel Studio video on Instagram and TikTok (publish-copy.json → PUBLISH_PACK.md) - a search card and a teaser in the creator's own dialect, never a retelling of the video. Use at every delivery, for every podcast clip, and when the creator asks for «وصف المنشور», «وصف البوست», «كابشن البوست», «كابشن المنشور», the text under the video, hashtags or post SEO, or asks to fix one. Not for the on-screen captions (the spoken words shown on the video, edited in the Review Editor). A bare «الكابشن» or «caption» can mean either, so decide from context and ask one short question only if it is still unclear.
---

# Social captions — the post description

This skill is the only guide for the text posted **under** the video (`publish-copy.json` → `PUBLISH_PACK.md`). It never changes the on-screen captions (the spoken words shown on the video, `captionsGrouping` / `captionsPresentation`). Other instructions in this folder only point here for the post description.

**Which captions?** In Reel Studio «الكابشن» usually means the on-screen captions (the Review Editor captions panel, `captionsGrouping`, `captionsPresentation`). This skill is only for the text under the video. If the creator says just «الكابشن» or "caption": timing, words on the video, font, position, size or the editor = on-screen captions, so do not use this skill; posting, hashtags, platforms, search or the text under the video = this skill. If it is still unclear, ask once: «تقصد الكابشن اللي على الفيديو ولا وصف المنشور؟» and run nothing until they answer.

The video delivers the content. The description has two other jobs:

1. **Search card:** the words people type go in the first line, so Instagram and TikTok search can match the video.
2. **Teaser:** it makes someone who has not watched want to, and someone who watched act (comment the keyword, save, share). It never retells the video.

## 1. Collect before writing

- Run `node scripts/profile.mjs writing --project <slug>`. Its `writingStyle`, `platforms` and `cta` are binding for this video; its `guide` is a one-line reminder of the shape (see the writing-style rule below).
- Read the reviewed spoken words (`captions.words` in `Projects/<slug>/edit.json`). Every claim must be in the video; keep the creator's conditions (what is free, who it suits, limits).
- **Dialect:** write in the language and dialect the creator speaks in this video, judged from those reviewed words: Gulf, Egyptian, Levantine, Iraqi, Maghrebi, Modern Standard Arabic or another language. `PROFILE.json` `language` is always `ar-EG` today and does not tell you their dialect. If the words mix dialects or you cannot tell, ask the creator once in one line and use the answer. Keep product and tool names exactly as people type them.
- Choose one **primary search phrase** (what a viewer would type: the topic or the tool name) and 2-4 secondary terms (tool names, one plain term in the creator's language).
- If the creator shares some of their own past captions, match their voice: line length, emoji, how they ask for comments.

## 2. Write `Projects/<slug>/publish-copy.json`

```json
{"title": "<short hook, at most 80 characters>",
 "instagram": {"caption": "<Instagram text>", "hashtags": ["#<topic>", "#<topic>"]},
 "tiktok": {"caption": "<a separately written TikTok text>", "hashtags": ["#<topic>"]},
 "notes": ["<what the copy deliberately does not promise>"]}
```

Include only the platforms printed by `writing`. Hashtags go in `hashtags`, never inside `caption`: 1 to 5 per platform, on topic (the main subject or product, 1-2 specific tags, 1-2 tags people search in the creator's language). Mention no account except the profile handle.

- **Re-say, don't repeat.** Never copy the creator's spoken sentences; a short quoted phrase only when it is the hook keyword itself.
- **Name, don't explain.** Name what people search for, keep what each thing does inside the video, and leave the payoff open (for example, hint that one step is the one most people miss).
- **Add a layer** the video lacks when it helps: who it is for, when to use it, a caution or a condition.
- **Instagram:** the first ~125 characters show before "more": the primary search phrase plus a hook worded differently from the spoken hook. Then about three short blocks: what you get or who it is for, an optional open loop, and the comment-keyword line only when `cta` is non-null, with the exact keyword.
- **TikTok:** shorter and written separately: search phrase and hook in the first line, one payoff tease, the comment keyword only when `cta` is non-null.
- The resolved `writingStyle` sets the shape, never the depth: every style stays a teaser. `short`: one clear opening line, one benefit and one ask, at most 450 characters per caption. `educational`: a few short practical points (who it suits, what you get, a condition) that make people want the full explanation in the video, never the explanation itself. `storytelling`: a short situation in new words that leads to the video without walking through its steps or giving its conclusion. If the printed `guide` seems to ask for more, this rule wins.

## Never

- Retell the video or list every point with its explanation.
- Invent numbers, results, prices, urgency or official claims, or promise reach and views.
- Use engagement bait (a follow or like request as the whole message) or giveaway framing unless the creator runs a real giveaway.
- Add platform disclaimers, use the same text on two platforms, or write in a dialect the creator does not speak.
- Post anything. The creator publishes it.

## 3. Check, then build the pack

While rewriting, check quickly (it writes nothing):

```
node scripts/caption-check.mjs --project <slug> --keyword "<primary search phrase>"
```

Then build the pack with the same search phrase:

```
node scripts/publish-pack.mjs --project <slug> --video <the accepted MP4> --keyword "<primary search phrase>"
```

Both apply the publish-copy rules (platforms, 1-5 hashtags, the video's comment keyword, the `short` limit) and refuse a caption that repeats 6 or more spoken words in a row, takes more than 20 % of its 3-word phrases from the spoken words, leaves the search phrase out of its opening (the first 125 characters on Instagram, 100 on TikTok), uses a filler hashtag (#fyp, #foryou, #explore, #viral), or shares more than half its phrases with the other platform. `publish-pack.mjs` writes `PUBLISH_PACK.md` only when the copy passes. On a failure, rewrite and run it again. Show the creator each platform's text, ready to paste.
