# documentary

## Look

Warm paper, muted sea and land, a red route, joined Arabic city labels and torn photo cards. A deterministic archival grain sits over the material. The proposed Arabic label is «وثائقي».

## Best for

Explaining a creator-supplied journey, geographic focus or named archival image without inventing events or evidence.

## Layouts and footage

Own scenes use `takeover`. Normal shared scenes and recorded captions remain available for presenter passages. Picture in picture is disabled because it has not been checked on footage. Own scenes draw their authored titles/captions; recorded caption pills are hidden there.

## Palette and brand

- **Brand colours:** not applied. Paper and ink stay neutral; the route uses dark red for contrast.

## Recipe

**Direction:** keep one place or supplied image legible while its relationship changes.

- **Decision:** choose it when geography or a named image carries the explanation, not just as decoration.
- **Composition/material:** one map or photo in the central safe band, a short title above, one torn explanation below. Names and explanatory text stay joined as whole runs.
- **Timing/action:** author scene-relative frame cues; route draws from origin to destination with one moving dot, focus eases the geographic viewport, photo cards settle once. Hold the resolved state for at least 0.6 seconds.
- **Transition/sound:** maps and their labels are silent; one low paper landing can mark the photo card arriving. No music or sweep. Effects follow [SOUND.md](../SOUND.md).
- **Application/review:** inspect real output for label collisions, map extent and supported claims. Check Arabic, natural source integrity and the safe area separately from creative acceptance.

## Style-owned scenes

The shared `route-stops` semantic beat also qualifies this style. It keeps its existing data schema and remains available in other styles.

Common scene fields: `id`, `fromFrame`, `durationInFrames`, `layout: takeover`, `motion`. Data is strict. Text is authored explanation, not a fabricated transcript.

- `map-route`: `title`, optional `caption`, `places` (2–5, each `{name,lon,lat}`; a bare `{name}` works only for a city in the installed data, and the installed data has none), optional `bounds: [west,south,east,north]`, `borders` (default false), `drawAt` (default 15), `drawDuration` (default 75). Geographic coordinates are reviewed longitude/latitude; the route is an illustrative straight projected route, never a measured road, flight or border. Match the scene-relative cues to the spoken meaning. Five labels may need a wider extent; review overlap rather than guessing a layout from green validation.
- `map-focus`: `title`, optional `caption`, `target` (city point/name as above or `{country}` matching installed `name_ar`), optional `bounds`, `borders`, `zoom` (1–4, default 2), `focusAt` (15), `focusDuration` (60). Country lookup requires verified installed geography. Zoom interpolates geographic bounds; text remains a fixed readable size. With a country target, explicitly choose whether borders should be visible.
- `cutout-card`: `title`, `caption`, `image: {src,sha256,width,height,kind: image}`, optional `credit`, `at` (10), `tilt` (-4..4, default -2), `fit` (`contain` default; `cover` only when cropping is approved). Use **only creator-named project images**, staged via the normal asset path/hash checks. The renderer does not search for photos or create cut-outs of a person. Existing alpha is preserved inside a torn paper card. The library illustration is a placeholder and delivery rejects it until replaced.

Map data is a local build input: see `engine/src/maps/data/README.md` and `scripts/build-map-data.mjs`. No dataset or country viewpoint is silently substituted. The installed data is Natural Earth (public domain), checked by eye: land and sea, and country borders from the Palestine point of view (Palestine is a separate state labelled «فلسطين», the Golan is part of Syria; the same file draws Western Sahara inside Morocco). It has no named cities, so city dots always come from authored coordinates. Border-free mode draws land, sea, the red route and city dots only. A tiny two-square fixture lives under `tests/fixtures/` for tests; it is never a real map.

## Avoid

- Unverified borders, invented place coordinates, unreviewed photos, implied archival authenticity, long labels or crowded routes. A visual style does not verify a geographic or historical claim.
