// Equirectangular projection in degrees. No geographic dataset is inferred here.
export type Position = [number, number];
export type Bounds = [number, number, number, number];
export type Polygon = Position[][];
export type MapData = {version: 1; mode: 'no-borders' | 'countries'; land: Polygon[]; countries: {id: string; name_ar: string; polygons: Polygon[]}[]; places: {name_ar: string; lon: number; lat: number}[]; provenance: string};

export const EMPTY_MAP: MapData = {version: 1, mode: 'no-borders', land: [], countries: [], places: [], provenance: 'No geographic data installed. Supply coastline polygons with build-map-data.mjs.'};
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => {const p = clamp01(n); return p * p * (3 - 2 * p);};
export function unwrap(lon: number, centre: number): number {return Math.abs(lon-centre)<=180 ? lon : lon + 360 * Math.round((centre - lon) / 360);}
export function project([lon, lat]: Position, bounds: Bounds, width: number, height: number) {
  const [west, south, east, north] = bounds;
  return {x: (unwrap(lon, (west + east) / 2) - west) / (east - west) * width, y: (north - lat) / (north - south) * height};
}
export function fitBounds(points: Position[], aspect = 1, padding = .3): Bounds {
  if (!points.length) return [-180, -90, 180, 90];
  const xs = points.map(p => unwrap(p[0], points[0][0]));
  const ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max(4, Math.max(...xs) - Math.min(...xs)) * (1 + padding * 2);
  const h = Math.max(4, Math.max(...ys) - Math.min(...ys)) * (1 + padding * 2);
  const fw = Math.max(w, h * aspect), fh = Math.max(h, w / aspect);
  return [cx - fw / 2, cy - fh / 2, cx + fw / 2, cy + fh / 2];
}
export function polygonPath(rings: Polygon, bounds: Bounds, width: number, height: number): string {
  return rings.map(ring => ring.map((p, i) => {const {x,y} = project(p,bounds,width,height);return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join(' ') + 'Z').join(' ');
}
const ringArea = (ring: Position[]) => ring.reduce((sum, p, i) => {const q = ring[(i + 1) % ring.length];return sum + p[0] * q[1] - q[0] * p[1];}, 0) / 2;
const ringBox = (ring: Position[]): Bounds => ring.reduce<Bounds>((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
/**
 * The main body of a country: its largest polygon plus the parts within `near` degrees of it (Gaza next to the West Bank, Corsica
 * next to France), never far territories that would zoom the map out to half the world. `anchor` is the centroid of the largest
 * polygon, so the country's label sits on the country itself and never in the gap between two of its parts.
 */
export function countryFocus(polygons: Polygon[], near = 8): {points: Position[]; anchor: Position} {
  if (!polygons.length) throw new Error('A country needs at least one polygon');
  const main = polygons.reduce((best, p) => Math.abs(ringArea(p[0])) > Math.abs(ringArea(best[0])) ? p : best, polygons[0]);
  const m = ringBox(main[0]);
  const close = polygons.filter(p => {const b = ringBox(p[0]);return b[0] <= m[2] + near && b[2] >= m[0] - near && b[1] <= m[3] + near && b[3] >= m[1] - near;});
  const area = ringArea(main[0]);let cx = 0, cy = 0;
  main[0].forEach((p, i) => {const q = main[0][(i + 1) % main[0].length];const f = p[0] * q[1] - q[0] * p[1];cx += (p[0] + q[0]) * f;cy += (p[1] + q[1]) * f;});
  const anchor: Position = area ? [cx / (6 * area), cy / (6 * area)] : [(m[0] + m[2]) / 2, (m[1] + m[3]) / 2];
  return {points: close.flatMap(p => p[0]), anchor};
}
/** Distance in projected space, so a moving marker follows the actual drawn polyline. */
export function routeAt(points: Position[], progress: number): Position {
  if (!points.length) throw new Error('A route needs points');
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((p,i) => Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let distance = lengths.reduce((a,b)=>a+b,0) * clamp01(progress);
  for (let i=0;i<lengths.length;i++) {
    if (distance <= lengths[i] || i===lengths.length-1) {const t=lengths[i] ? distance/lengths[i] : 0;return [points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t];}
    distance -= lengths[i];
  }
  return points.at(-1)!;
}
