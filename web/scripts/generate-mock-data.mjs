// Generates SYNTHETIC visibility CSVs in the Moon Trek export format so the UI
// can be developed before the real data exists. Run: pnpm mock-data
//
// Sun and Earth directions use a crude model (synodic month, libration,
// seasonal solar declination) and each site gets a random horizon profile.
// The numbers are NOT physically accurate. Replace with real exports.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

// The 13 Artemis III candidate regions (NASA, Aug 2022).
// Coordinates are ROUGH placeholders; replace them with the real site centers.
const SITES = [
  ['faustini-rim-a', 'Faustini Rim A', -87.1, 82.0],
  ['peak-near-shackleton', 'Peak Near Shackleton', -88.8, 124.0],
  ['connecting-ridge', 'Connecting Ridge', -89.4, -137.0],
  ['connecting-ridge-extension', 'Connecting Ridge Extension', -89.0, -100.0],
  ['de-gerlache-rim-1', 'de Gerlache Rim 1', -88.7, -68.0],
  ['de-gerlache-rim-2', 'de Gerlache Rim 2', -88.3, -64.0],
  ['de-gerlache-kocher-massif', 'de Gerlache-Kocher Massif', -85.8, -115.0],
  ['haworth', 'Haworth', -86.8, -15.0],
  ['malapert-massif', 'Malapert Massif', -85.9, 0.0],
  ['leibnitz-beta-plateau', 'Leibnitz Beta Plateau', -85.4, 31.0],
  ['nobile-rim-1', 'Nobile Rim 1', -84.4, 61.0],
  ['nobile-rim-2', 'Nobile Rim 2', -83.9, 58.0],
  ['amundsen-rim', 'Amundsen Rim', -84.3, 70.0],
]

const START = Date.UTC(2026, 11, 1)
const DAYS = 90
const STEP_HOURS = 2
const CAMERA_HEIGHT_M = 2.0

const DAY_MS = 86_400_000
const SYNODIC_DAYS = 29.530589
const LIBRATION_LAT_DAYS = 27.212221
const LIBRATION_LON_DAYS = 27.554550
const ECLIPTIC_YEAR_DAYS = 346.62

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

// Deterministic PRNG so the mock data is reproducible.
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const unit = (latDeg, lonDeg) => {
  const la = rad(latDeg)
  const lo = rad(lonDeg)
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Elevation and azimuth (from north, clockwise) of direction d at a site. */
function localAngles(latDeg, lonDeg, d) {
  const la = rad(latDeg)
  const lo = rad(lonDeg)
  const up = unit(latDeg, lonDeg)
  const east = [-Math.sin(lo), Math.cos(lo), 0]
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]
  const ele = deg(Math.asin(dot(d, up)))
  const az = (deg(Math.atan2(dot(d, east), dot(d, north))) + 360) % 360
  return { ele, az }
}

/** Random smooth horizon elevation profile (degrees) as a function of azimuth. */
function makeHorizon(rand) {
  const base = rand() * 1.5 - 0.3
  const terms = [1, 2, 3, 5].map((k) => ({
    k,
    amp: (rand() * 2.5) / k,
    phase: rand() * 2 * Math.PI,
  }))
  return (az) =>
    base + terms.reduce((sum, t) => sum + t.amp * Math.sin(t.k * rad(az) + t.phase), 0)
}

const HEADER =
  'UTC,CAMERA_LAT,CAMERA_LON,CAMERA_HEIGHT,SUN_VIS,CAMERA_TO_SUN_INT_LAT,CAMERA_TO_SUN_INT_LON,' +
  'CAMERA_TO_SUN_INT_HEIGHT,SUN_ELE,SUN_AZMT,EARTH_VIS,CAMERA_TO_EARTH_INT_LAT,' +
  'CAMERA_TO_EARTH_INT_LON,CAMERA_TO_EARTH_INT_HEIGHT,EARTH_ELE,EARTH_AZMT,SUN_EARTH_ANGLE'

mkdirSync(OUT_DIR, { recursive: true })

SITES.forEach(([id, , lat, lon], i) => {
  const horizon = makeHorizon(mulberry32(1000 + i))
  const lines = [HEADER]

  for (let h = 0; h <= DAYS * 24; h += STEP_HOURS) {
    const t = START + h * 3_600_000
    const days = (t - START) / DAY_MS

    // Sub-solar point circles the Moon once per synodic month.
    const sunDir = unit(
      1.54 * Math.sin((2 * Math.PI * days) / ECLIPTIC_YEAR_DAYS),
      180 - (360 * days) / SYNODIC_DAYS,
    )
    // Sub-Earth point wobbles around (0, 0) due to libration.
    const earthDir = unit(
      6.7 * Math.sin((2 * Math.PI * days) / LIBRATION_LAT_DAYS),
      7.9 * Math.sin((2 * Math.PI * days) / LIBRATION_LON_DAYS),
    )

    const sun = localAngles(lat, lon, sunDir)
    const earth = localAngles(lat, lon, earthDir)
    // The Sun is a 0.5° disc: count it as visible if its center clears the horizon.
    const sunVis = sun.ele > horizon(sun.az) ? 1 : 0
    const earthVis = earth.ele > horizon(earth.az) ? 1 : 0
    const sunEarthAngle = deg(Math.acos(Math.max(-1, Math.min(1, dot(sunDir, earthDir)))))

    lines.push(
      [
        new Date(t).toISOString(),
        lat.toFixed(5),
        lon.toFixed(5),
        CAMERA_HEIGHT_M.toFixed(1),
        sunVis,
        'nan', 'nan', 'nan',
        sun.ele.toFixed(2),
        sun.az.toFixed(2),
        earthVis,
        'nan', 'nan', 'nan',
        earth.ele.toFixed(2),
        earth.az.toFixed(2),
        sunEarthAngle.toFixed(2),
      ].join(','),
    )
  }

  writeFileSync(join(OUT_DIR, `${id}.csv`), lines.join('\n') + '\n')
})

const manifest = {
  mock: true,
  note: 'Synthetic data and approximate coordinates. Replace public/data/ with the real Moon Trek exports.',
  sites: SITES.map(([id, name, lat, lon]) => ({ id, name, lat, lon, file: `${id}.csv` })),
}
writeFileSync(join(OUT_DIR, 'sites.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`Wrote ${SITES.length} mock CSVs and sites.json to ${OUT_DIR}`)
