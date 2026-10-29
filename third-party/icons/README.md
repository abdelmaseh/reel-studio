# Animated icons (useAnimations, Meteocons)

Status: **installed.** The files below were downloaded once, after the owner approved each one (name, source, size), and live in
`engine/public/stickers/icons/` so Remotion can serve them with `staticFile()`. A scene that names a missing file stops with a message that points here.

Both sources are MIT licensed. The licence texts are kept next to this page (`LICENSE-useanimations`, `LICENSE-meteocons`) and credited in `NOTICE.md`.
Credits live only there and in this folder, never on videos or the studio screen.

## Sources

- **useAnimations** (MIT): https://github.com/useanimations/react-useanimations
  Files are fetched from `https://raw.githubusercontent.com/useanimations/react-useanimations/035f164df779da512f06f1de4b0b59f7bf5624ba/icons/`. Licence text: `third-party/icons/LICENSE-useanimations`.
- **Meteocons** (MIT): https://github.com/basmilius/meteocons
  Files are fetched from `https://cdn.jsdelivr.net/npm/@meteocons/lottie@0.1.0/fill/`. Licence text: `third-party/icons/LICENSE-meteocons`.

## Files (20 icons, 59065 bytes = 57.7 KB)

The code reads them through `engine/src/creative-kit/stickers.ts` (`kind: "lottie"`) and plays them with `engine/src/core/lottie-icon.tsx`. A downloaded
file must have exactly the size in the table; `tests/stickers.test.mjs` checks size and Lottie shape for every file that is present.

### useAnimations (15 icons, 39128 bytes)

| id | Arabic label | upstream file | bytes | installed as |
| --- | --- | --- | ---: | --- |
| `checkmark` | علامة صح | `checkmark.json` | 981 | `engine/public/stickers/icons/checkmark.json` |
| `check-circle` | صح داخل دائرة | `checkCircle.json` | 2355 | `engine/public/stickers/icons/check-circle.json` |
| `alert-triangle` | تنبيه مثلث | `alertTriangle.json` | 3325 | `engine/public/stickers/icons/alert-triangle.json` |
| `info` | معلومة | `info.json` | 2489 | `engine/public/stickers/icons/info.json` |
| `help` | سؤال | `help.json` | 2621 | `engine/public/stickers/icons/help.json` |
| `heart` | قلب | `heart.json` | 2421 | `engine/public/stickers/icons/heart.json` |
| `star` | نجمة | `star.json` | 2050 | `engine/public/stickers/icons/star.json` |
| `thumbs-up` | إعجاب | `thumbUp.json` | 6883 | `engine/public/stickers/icons/thumbs-up.json` |
| `trending-up` | منحنى صاعد | `trendingUp.json` | 1940 | `engine/public/stickers/icons/trending-up.json` |
| `trending-down` | منحنى هابط | `trendingDown.json` | 1944 | `engine/public/stickers/icons/trending-down.json` |
| `bar-chart` | أعمدة بيانية | `barChart.json` | 3368 | `engine/public/stickers/icons/bar-chart.json` |
| `target` | هدف | `target.json` | 3266 | `engine/public/stickers/icons/target.json` |
| `zap` | برق | `zap.json` | 1624 | `engine/public/stickers/icons/zap.json` |
| `lock` | قفل | `lock.json` | 1668 | `engine/public/stickers/icons/lock.json` |
| `notification` | كتم التنبيهات | `notification.json` | 2193 | `engine/public/stickers/icons/notification.json` |

### Meteocons, fill style, `@meteocons/lottie@0.1.0` (5 icons, 19937 bytes)

| id | Arabic label | upstream file | bytes | installed as |
| --- | --- | --- | ---: | --- |
| `weather-clear-day` | شمس | `clear-day.json` | 7302 | `engine/public/stickers/icons/weather-clear-day.json` |
| `weather-clear-night` | ليل صافٍ | `clear-night.json` | 1820 | `engine/public/stickers/icons/weather-clear-night.json` |
| `weather-lightning-bolt` | صاعقة | `lightning-bolt.json` | 2845 | `engine/public/stickers/icons/weather-lightning-bolt.json` |
| `weather-rainbow` | قوس قزح | `rainbow.json` | 3511 | `engine/public/stickers/icons/weather-rainbow.json` |
| `weather-thermometer` | ميزان حرارة | `thermometer.json` | 4459 | `engine/public/stickers/icons/weather-thermometer.json` |
