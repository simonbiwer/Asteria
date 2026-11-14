import Papa from 'papaparse'
import type { Manifest, Sample, Site, SiteData } from '../types'

const DATA_URL = `${import.meta.env.BASE_URL}data/`

const REQUIRED_COLUMNS = [
  'UTC',
  'SUN_VIS',
  'SUN_ELE',
  'SUN_AZMT',
  'EARTH_VIS',
  'EARTH_ELE',
  'EARTH_AZMT',
] as const

async function fetchText(file: string): Promise<string> {
  const res = await fetch(DATA_URL + file)
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`)
  return res.text()
}

export async function loadManifest(): Promise<Manifest> {
  return JSON.parse(await fetchText('sites.json')) as Manifest
}

/** Parses a visibility CSV in the Moon Trek export format. */
export function parseVisibilityCsv(text: string, fileName: string): Sample[] {
  const { data, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const missing = REQUIRED_COLUMNS.filter((c) => !meta.fields?.includes(c))
  if (missing.length > 0) {
    throw new Error(`${fileName}: missing column(s) ${missing.join(', ')}`)
  }

  return data
    .map((row) => ({
      t: Date.parse(row.UTC),
      sunVis: row.SUN_VIS.trim() === '1',
      earthVis: row.EARTH_VIS.trim() === '1',
      sunEle: Number(row.SUN_ELE),
      sunAz: Number(row.SUN_AZMT),
      earthEle: Number(row.EARTH_ELE),
      earthAz: Number(row.EARTH_AZMT),
    }))
    .filter((s) => !Number.isNaN(s.t))
    .sort((a, b) => a.t - b.t)
}

async function loadSite(site: Site): Promise<SiteData> {
  const text = await fetchText(site.file)
  return { site, samples: parseVisibilityCsv(text, site.file) }
}

export async function loadAll(): Promise<{ manifest: Manifest; data: SiteData[] }> {
  const manifest = await loadManifest()
  const data = await Promise.all(manifest.sites.map(loadSite))
  return { manifest, data }
}
