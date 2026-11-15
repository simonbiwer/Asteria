// Generates SYNTHETIC visibility CSVs in the Moon Trek export format so the UI
// can be developed before the real data exists. Run: pnpm mock-data
//
// Sun and Earth directions use a crude model (synodic month, libration,
// seasonal solar declination) and each site gets a random horizon profile.
// The numbers are NOT physically accurate. Replace with real exports.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'data')
const REGIONS_FILE = join(ROOT, '..', 'data', 'A3_Named_regions_SP.geojson')

// GeoJSON label -> display name, where the label differs.
const NAME_FIXES = {
  'de Gerlache Rim': 'de Gerlache Rim 1',
  'Peak Near Shakleton': 'Peak Near Shackleton',
}

const MOON_R = 1737.4
const toStereo = (lat, lon) => {
  const k = 2 * MOON_R * Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)
  return [k * Math.sin((lon * Math.PI) / 180), k * Math.cos((lon * Math.PI) / 180)]
}
const fromStereo = (x, y) => [
  (2 * Math.atan(Math.hypot(x, y) / (2 * MOON_R)) * 180) / Math.PI - 90,
  (Math.atan2(x, y) * 180) / Math.PI,
]

/**
 * Center of each Artemis III candidate region (NASA, Aug 2022): mean of the
 * polygon vertices in south polar stereographic coordinates, which avoids
 * problems with longitudes wrapping around near the pole.
 */
function loadSites() {
  const { features } = JSON.parse(readFileSync(REGIONS_FILE, 'utf8'))
  return features.map((f) => {
    const name = NAME_FIXES[f.properties.label] ?? f.properties.label
    const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => toStereo(lat, lon))
    const x = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const y = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const [lat, lon] = fromStereo(x, y)
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return [id, name, Number(lat.toFixed(4)), Number(lon.toFixed(4))]
  })
}

const SITES = loadSites()

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
  note: 'Synthetic visibility data at the region centers. Replace public/data/ with the real Moon Trek exports.',
  sites: SITES.map(([id, name, lat, lon]) => ({ id, name, lat, lon, file: `${id}.csv` })),
}
writeFileSync(join(OUT_DIR, 'sites.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`Wrote ${SITES.length} mock CSVs and sites.json to ${OUT_DIR}`)
