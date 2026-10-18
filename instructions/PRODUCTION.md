# Resumable rendering and revisions

Use the ordinary editing, transcript, cut, privacy and delivery gates in `EDITING.md`. Preserve the original master and named media. Every revision writes a new output; review its real frames and ask the creator to play its sound before accepting it. A second version of a delivered reel is a new project (`EDITING.md`, delivery).

## Render and resume

Full renders longer than twenty seconds, or exceeding the ordinary resource budget, use bounded chunks automatically. Cache identity includes the composition, props, assets, encoding and scan policy. Repeat the same command after interruption: verified matching parts are reused; changed inputs require new parts. A running producer retains its lock.

For an explicit chunk size through the ordinary editor:

```text
node scripts/editor.mjs render Projects/example/edit.json --deliver --motion-plan Projects/example/motion-plan.json --chunk-frames 300 --chunk-jobs 1
```

`chunk-frames` is rounded to complete GOP units. Use one chunk job on constrained systems; at most two are allowed. Do not bypass a failed resource, decode, scan or delivery check. When a black interval is intentional and reviewed, `--intentional-black 0-5,300-305` declares inclusive frames in the complete composition. Never declare the entire video to suppress a scan failure.

## Audio-only revision

The timeline must match the base frame count and fps. Tracks share a 48 kHz sample clock, with source cuts and placement expressed in timeline frames. Resampling happens before sample cuts. Use a measured offset only when alignment evidence supports it; no universal codec-delay offset applies.

Example `Projects/example/audio.json`:

```json
{
  "version": 1,
  "fps": 30,
  "durationInFrames": 300,
  "sync": {"sampleRate": 48000, "offsetSamples": 0, "basis": "timeline"},
  "mix": {"voiceDb": 0, "musicDb": -18, "sfxDb": -10},
  "tracks": [
    {"kind": "voice", "src": "Projects/example/voice.wav", "fromFrame": 0, "sourceFromFrame": 0, "durationInFrames": 300},
    {"kind": "music", "src": "Projects/example/music.wav", "fromFrame": 0, "sourceFromFrame": 0, "durationInFrames": 300}
  ]
}
```

```text
node scripts/render-audio.mjs --base Projects/example/master.mp4 --timeline Projects/example/audio.json --out Projects/example/audio-revision.mp4 --music-db -24 --sfx-db -10
```

The command verifies unchanged video packets/timing, source integrity, frame count, stereo AAC, final loudness and encoding. Music and effects have separate gain controls. Check the balance on the resulting file as well as the approved preview. The QC sidecar records the revision.

## Effects level

The delivery mix places the effects stem so its peak sits a fixed distance under the voice peak (`--under`, default 7 dB). Start from 7 for sparse effects (a cue on real state changes only), 9 to 10 for dense effects or a stem that carries music, and add 2 whenever the creator says the effects are loud. Judge by the measured `sfxGainDb` in the mix report, not by the number alone: one loud cue lowers every other cue with it, so a single too-loud recipe is better quietened in the edit (`gain`) than by the whole stem. Pass it through the editor render or the mix directly:

```text
node scripts/editor.mjs render Projects/<slug>/edit.json --deliver --motion-plan Projects/<slug>/motion-plan.json --sfx-under 9
node scripts/mix.mjs --video Projects/<slug>/renders/edit-delivery.vo.mp4 --sfx Projects/<slug>/prepared/sounds.wav --out Projects/<slug>/renders/edit-delivery.mp4 --under 9
```

Which effect, when and how loud: [SOUND.md](SOUND.md).

## Picture-range revision

Use a verified PreparedEdit master and newly prepared props. Source, cuts and global settings must remain compatible. Changes outside the selected range, including caption emphasis or shared assets, require a full render. The replacement range is inclusive.

```text
node scripts/render-segment.mjs --props-file Projects/example/revised/props.json --frames 60-119 --out Projects/example/replacement.mp4
node scripts/splice-segment.mjs --base Projects/example/master.mp4 --segment Projects/example/replacement.mp4 --frames 60-119 --out Projects/example/picture-revision.mp4 --motion-plan Projects/example/motion-plan.json
```

Use `--motion-exempt static-graphics` only for a verified screen/graphics-only source. Presenter footage needs its real motion/head evidence, as in ordinary delivery. This repeats Remotion for the selected frames and performs a lightweight FFmpeg picture encode for exact joins. Original base audio packets/timing are retained. Full picture and final encode checks run before promotion.

Both commands reject output aliases of their inputs, including Windows case changes, hard links and protected metadata. Never overwrite the accepted master to save a filename.
