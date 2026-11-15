// Builds public/data/ for the app from the repo's data/ folder:
//  - sites.json with every Artemis III candidate region, located at the
//    center of its polygon in data/A3_Named_regions_SP.geojson
//  - a copy of data/landing-sites/<site-id>.csv for every site that has one
// Runs automatically before `pnpm dev` and `pnpm build`.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(WEB, '..', 'data')
const REGIONS_FILE = join(DATA, 'A3_Named_regions_SP.geojson')
const CSV_DIR = join(DATA, 'landing-sites')
const OUT_DIR = join(WEB, 'public', 'data')

const REQUIRED_COLUMNS = ['UTC', 'CAMERA_LAT', 'CAMERA_LON', 'CAMERA_HEIGHT', 'SUN_VIS', 'EARTH_VIS']
/** Reject a CSV whose camera position is farther than this from the region center. */
const MAX_OFFSET_KM = 1

// GeoJSON label -> display name, where the label differs.
const NAME_FIXES = {
  'de Gerlache Rim': 'de Gerlache Rim 1',
  'Peak Near Shakleton': 'Peak Near Shackleton',
}

const MOON_R_KM = 1737.4
const toStereo = (lat, lon) => {
  const k = 2 * MOON_R_KM * Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)
  return [k * Math.sin((lon * Math.PI) / 180), k * Math.cos((lon * Math.PI) / 180)]
}
const fromStereo = (x, y) => [
  (2 * Math.atan(Math.hypot(x, y) / (2 * MOON_R_KM)) * 180) / Math.PI - 90,
  (Math.atan2(x, y) * 180) / Math.PI,
]
/** Great-circle distance on the Moon (haversine). */
const distanceKm = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * MOON_R_KM * Math.asin(Math.sqrt(h))
}

/** Region centers: mean of polygon vertices in polar stereographic coordinates. */
function loadRegions() {
  const { features } = JSON.parse(readFileSync(REGIONS_FILE, 'utf8'))
  return features.map((f) => {
    const name = NAME_FIXES[f.properties.label] ?? f.properties.label
    const ring = f.geometry.coordinates[0].slice(0, -1).map(([lon, lat]) => toStereo(lat, lon))
    const x = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const y = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const [lat, lon] = fromStereo(x, y)
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return { id, name, lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) }
  })
}

/**
 * Checks a CSV's header and camera position. Errors mean the file is unusable
 * (it would crash the app or describe a different place) and is skipped.
 */
function checkCsv(path, site) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = lines[0].split(',').map((h) => h.trim())
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) return { errors: [`missing column(s) ${missing.join(', ')}`] }

  const col = (name) => header.indexOf(name)
  const first = lines[1].split(',')
  const period = `${first[col('UTC')].slice(0, 10)} – ${lines.at(-1).split(',')[col('UTC')].slice(0, 10)}`
  const camera = {
    lat: Number(first[col('CAMERA_LAT')]),
    lon: Number(first[col('CAMERA_LON')]),
    height: Number(first[col('CAMERA_HEIGHT')]),
  }
  const errors = []
  if (Number.isNaN(camera.lat) || Number.isNaN(camera.lon)) {
    errors.push('first row has an invalid CAMERA_LAT/CAMERA_LON')
  } else {
    const offset = distanceKm(camera, site)
    if (offset > MAX_OFFSET_KM) {
      errors.push(
        `camera at ${camera.lat}, ${camera.lon} is ${offset.toFixed(1)} km from the region center ` +
          `(${site.lat}, ${site.lon})`,
      )
    }
  }
  return { rows: lines.length - 1, camera, period, errors }
}

const regions = loadRegions()

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const csvFiles = existsSync(CSV_DIR) ? readdirSync(CSV_DIR).filter((f) => f.endsWith('.csv')) : []
let warningCount = 0
/** period -> site names, to detect sites computed for different periods. */
const periods = new Map()

const sites = regions.map((site) => {
  const file = `${site.id}.csv`
  if (!csvFiles.includes(file)) {
    console.log(`  –  ${site.name}: no data`)
    return { ...site, file: null }
  }
  const { rows, camera, period, errors } = checkCsv(join(CSV_DIR, file), site)
  if (errors.length > 0) {
    console.warn(`  ✗  ${site.name}: ${file} skipped`)
    for (const e of errors) console.warn(`     ${e}`)
    warningCount++
    return { ...site, file: null }
  }
  copyFileSync(join(CSV_DIR, file), join(OUT_DIR, file))
  if (period) periods.set(period, [...(periods.get(period) ?? []), site.name])
  console.log(
    `  ✓  ${site.name}: ${rows ?? '?'} rows, ${period ?? '?'}` +
      (camera ? `, camera height ${camera.height} m (above the 1737.4 km sphere)` : ''),
  )
  return { ...site, file }
})

for (const f of csvFiles) {
  if (!regions.some((r) => `${r.id}.csv` === f)) {
    console.warn(`  ⚠  ${f} does not match any site id; ignored`)
    warningCount++
  }
}

if (periods.size > 1) {
  console.warn('  ⚠  Sites cover different time periods, so their rankings are not comparable:')
  for (const [period, names] of periods) console.warn(`       ${period}: ${names.join(', ')}`)
  warningCount++
}

writeFileSync(join(OUT_DIR, 'sites.json'), JSON.stringify({ sites }, null, 2) + '\n')

const withData = sites.filter((s) => s.file).length
console.log(
  `prepare-data: ${withData}/${sites.length} sites with data` +
    (warningCount ? `, ${warningCount} warning(s)` : ''),
)
