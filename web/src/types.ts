/** A candidate landing site, as listed in public/data/sites.json. */
export interface Site {
  id: string
  name: string
  /** Selenographic latitude in degrees (negative = southern hemisphere). */
  lat: number
  /** Selenographic longitude in degrees east. */
  lon: number
  /** CSV file name inside public/data/. */
  file: string
  /**
   * Height in metres above the surface that visibility was computed from
   * (CAMERA_HEIGHT in the CSV). Not terrain elevation. Set when the CSV loads.
   */
  heightM?: number
}

export interface Manifest {
  /** True while the data is synthetic placeholder data. */
  mock?: boolean
  note?: string
  sites: Site[]
}

/** One time step of a precomputed visibility CSV. */
export interface Sample {
  /** Unix time in ms (UTC). */
  t: number
  sunVis: boolean
  earthVis: boolean
  /** Elevation and azimuth in degrees, kept for the astronaut view later. */
  sunEle: number
  sunAz: number
  earthEle: number
  earthAz: number
}

export interface SiteData {
  site: Site
  samples: Sample[]
}

/** Aggregated visibility of one site over the selected time range. */
export interface SiteStats {
  site: Site
  /** Share of time (0–100) with the Sun visible. */
  sunPct: number
  /** Share of time (0–100) with the Earth visible. */
  earthPct: number
  /** Share of time (0–100) with both visible at once. */
  bothPct: number
  /** Longest continuous period without sunlight, in hours. */
  longestDarkHours: number
  sampleCount: number
}

export interface RankedSite extends SiteStats {
  score: number
  rank: number
}
