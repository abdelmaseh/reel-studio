# Podcast batches

Work only on the recording the creator names. Read `RULES.md` and `EDITING.md`. A long recording is proposed and reviewed once; each selected clip gets its own project, editor, approval, render evidence and publish pack. Every individual clip stays within the existing ten-minute edit limit; its source window can start anywhere in the long recording.

## 1. Reviewed transcript and proposals

Transcribe locally (a draft is enough to choose) and keep word timestamps in original recording seconds/milliseconds. Read the whole transcript yourself and pick 3 to 5 self-contained moments of 20-60 s: a question and its answer, a story with its ending, one clear idea. Show the creator only those, each with its first sentence, why it works as a clip and its start-end. Confirm the words inside the chosen windows only and save the corrected transcript. Use the name the creator gave as reviewer and approver; never type a placeholder such as `Creator`. Then:

```text
node scripts/podcast.mjs propose --source Raw/example-podcast.mp4 --transcript Projects/example-podcast/words.json --id example-podcast --reviewed-by "<creator name>" --min-sec 15 --max-sec 90
```

The proposal contains transcript quotations and pause-bounded source windows. It does not select or cut anything and does not judge which moments work as clips. Use it only as a map of clean edges: copy the exact start and end of each moment you chose from its nearest windows, then agree the final ranges with the creator, with complete words and clear context.

## 2. Record the actual selection

Write `Projects/example-podcast/selections.json` only after approval. Author beats using the selected source seconds. A minimal example:

```json
{
  "version": 1,
  "selectionApproved": true,
  "approvedBy": "<creator name>",
  "clips": [{
    "id": "one-idea",
    "fromSec": 630,
    "toSec": 660,
    "signoff": {"mode": "none"},
    "editor": {
      "purpose": "explainer",
      "tone": "calm",
      "style": "liquid-glass",
      "beats": [{
        "id": "opening",
        "fromSec": 630,
        "toSec": 635,
        "intent": "intro",
        "data": {"kicker": "الموضوع", "title": "عنوان من الكلام", "subtitle": "نقطة واضحة", "caption": "الكلام اللي اتقال"}
      }]
    }
  }]
}
```

Use `signoff.mode: "none"` when no recorded sign-off is retained; choose the recorded mode according to the module contract when it is included. Preserve the profile's actual CTA/follow decisions and author ending scenes when required. Do not invent an outro or synthesize speech to complete a clip. The selection rejects overlapping, out-of-bounds and partial-word ranges.

```text
node scripts/podcast.mjs select Projects/example-podcast/podcast/batch.json --selections Projects/example-podcast/selections.json
node scripts/podcast.mjs prepare Projects/example-podcast/podcast/batch.json
node scripts/podcast.mjs status Projects/example-podcast/podcast/batch.json
```

Preparation extracts each window, performs intake and rebases its word/beat times. It preserves original media/profile and existing manual formatting. Changed words, internal cuts, presenter exemptions or sign-off choices need a new reviewed selection. Open each returned `edit.json` in the live review editor.

## 3. Review and sequential export

```text
node scripts/podcast.mjs render Projects/example-podcast/podcast/batch.json
```

This creates previews sequentially. For final export, apply each clip's ordinary delivery planning, face check and motion plan first. Put render options under that clip id in `Projects/example-podcast/render-options.json`:

```json
{"one-idea": {"motionPlan": "Projects/example-clip/motion-plan.json", "voice": "clean", "chunkJobs": 1}}
```

```text
node scripts/podcast.mjs render Projects/example-podcast/podcast/batch.json --deliver --approved-by "<creator name>" --options Projects/example-podcast/render-options.json
```

Use the project path returned by preparation. Screen-only sources do not use presenter motion options. `--clip one-idea` limits prepare/render to one selected clip. Repeat the same render request after a failure; reuse requires matching manifest, options, current media/asset bytes, output and QC. A rendered status is not creative acceptance or publication.

## 4. Complete each delivery

Check each actual output with stills and its normal delivery checks, then ask the creator to play it with sound; you cannot hear it. For every clip, write its post description with the `social-captions` skill (project `<clip-project-id>`, video `<returned-output>`). Copy an MP4 to its `Outputs/` folder only after the creator accepts it. Report individual paths and each platform's post description. No external posting is implied.
