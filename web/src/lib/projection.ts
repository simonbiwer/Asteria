/** Mean lunar radius in km (IAU). */
export const MOON_RADIUS_KM = 1737.4

/**
 * South polar stereographic projection, as used by the LOLA/LROC polar
 * products: 0° longitude points up, 90°E points right.
 * Returns map coordinates in km, with y pointing up.
 */
export function polarStereoSouth(latDeg: number, lonDeg: number): { x: number; y: number } {
  const rho = 2 * MOON_RADIUS_KM * Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360)
  const lon = (lonDeg * Math.PI) / 180
  return { x: rho * Math.sin(lon), y: rho * Math.cos(lon) }
}
