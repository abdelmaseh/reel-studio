// Which installed fonts the settings page serves for its font previews, and under which family name.
// A preview family is built from one or more lock fonts; one lock font may appear in several families.
const ALL_SUBSETS = ['arabic', 'latin', 'latin-ext'];

export const PREVIEW_FAMILIES = Object.freeze([
  {alias: 'Cairo', parts: [{source: 'Cairo', weights: [400], css: '200 1000'}]},
  {alias: 'Tajawal', parts: [{source: 'Tajawal', weights: [400, 700]}]},
  {alias: 'Noto Naskh Arabic', parts: [{source: 'Noto Naskh Arabic', weights: [400, 700]}]},
  {alias: 'Plex Display', parts: [{source: 'IBM Plex Sans Arabic', weights: [700], css: '1 1000'}]},
  {alias: 'Grid Sans', parts: [
    // One Inter face per Arabic weight: a browser matches the weight first and applies unicode-range only among
    // faces with the same descriptors, so a single range face would leave bold Latin in the system serif.
    {source: 'Inter', subsets: ['latin'], weights: [400], cssWeights: [400, 500, 600, 700]},
    {source: 'IBM Plex Sans Arabic', subsets: ['arabic'], weights: [400, 500, 600, 700]},
  ]},
  {alias: 'Noto Kufi Arabic', parts: [{source: 'Noto Kufi Arabic', weights: [400], css: '100 900'}]},
  {alias: 'Readex Pro', parts: [{source: 'Readex Pro', weights: [400], css: '160 700'}]},
  {alias: 'El Messiri', parts: [{source: 'El Messiri', weights: [400], css: '400 700'}]},
]);

/** `{alias, face, css}` for every lock font a preview family needs; `css` is its font-weight. */
export function previewFaces(lockFonts) {
  return PREVIEW_FAMILIES.flatMap(({alias, parts}) => parts.flatMap((part) => lockFonts
    .filter((face) => face.family === part.source && face.style === 'normal'
      && (part.subsets ?? ALL_SUBSETS).includes(face.subset) && part.weights.includes(face.weight))
    .flatMap((face) => (part.cssWeights ?? [part.css ?? face.weight]).map((css) => ({alias, face, css: String(css)})))));
}
