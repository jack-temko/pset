export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;

/** The percents of fit width the zoom buttons and the menu step through. */
export const STEPS = [
  50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400,
] as const;

export const clampZoom = (z: number) =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** Within about 2% of fit width, a zoom is fit width. */
export const snapFit = (z: number) => (Math.abs(z - 1) < 0.02 ? 1 : z);

/** The zoom a two finger pinch asks for: the zoom when the second finger went
 *  down, scaled by how far apart the fingers are now against then. */
export function pinchZoom(startZoom: number, startDist: number, dist: number) {
  if (startDist <= 0 || dist <= 0) return startZoom;
  return snapFit(clampZoom((startZoom * dist) / startDist));
}

/** The next step up (1) or down (-1) from a zoom; the same at the ends. */
export function stepZoom(zoom: number, dir: 1 | -1) {
  const eps = 0.004;
  const pcts = STEPS.map((s) => s / 100);
  if (dir === 1) return pcts.find((s) => s > zoom + eps) ?? zoom;
  return [...pcts].reverse().find((s) => s < zoom - eps) ?? zoom;
}
