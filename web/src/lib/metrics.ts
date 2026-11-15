import type { RankedSite, SiteData, SiteStats } from '../types'

const HOUR_MS = 3_600_000

/**
 * Aggregates a site's samples within [from, to].
 * Each sample counts for the time until the next sample, so irregular
 * time steps are weighted correctly.
 */
export function computeStats({ site, samples }: SiteData, from: number, to: number): SiteStats {
  const s = samples.filter((x) => x.t >= from && x.t <= to)

  let total = 0
  let sun = 0
  let earth = 0
  let both = 0
  let darkRun = 0
  let longestDark = 0

  for (let i = 0; i < s.length; i++) {
    const dt =
      i < s.length - 1 ? s[i + 1].t - s[i].t : i > 0 ? s[i].t - s[i - 1].t : 0

    total += dt
    if (s[i].sunVis) sun += dt
    if (s[i].earthVis) earth += dt
    if (s[i].sunVis && s[i].earthVis) both += dt

    if (s[i].sunVis) {
      darkRun = 0
    } else {
      darkRun += dt
      longestDark = Math.max(longestDark, darkRun)
    }
  }

  const pct = (x: number) => (total > 0 ? (x / total) * 100 : 0)

  return {
    site,
    sunPct: pct(sun),
    earthPct: pct(earth),
    bothPct: pct(both),
    longestDarkHours: longestDark / HOUR_MS,
    sampleCount: s.length,
  }
}

/**
 * Ranks sites by a weighted score (0–100). Sites without data in the
 * selected period get rank null and are listed last.
 * @param sunWeight 0 = only Earth visibility counts, 1 = only sunlight counts.
 */
export function rankSites(stats: SiteStats[], sunWeight: number): RankedSite[] {
  const scored = stats.map((s) => ({
    ...s,
    score: sunWeight * s.sunPct + (1 - sunWeight) * s.earthPct,
  }))
  const withData = scored
    .filter((s) => s.sampleCount > 1)
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }))
  const withoutData = scored
    .filter((s) => s.sampleCount <= 1)
    .sort((a, b) => a.site.name.localeCompare(b.site.name))
    .map((s) => ({ ...s, rank: null }))
  return [...withData, ...withoutData]
}

/** Earliest and latest timestamp across all sites. */
export function dataTimeRange(data: SiteData[]): [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (const { samples } of data) {
    if (samples.length === 0) continue
    min = Math.min(min, samples[0].t)
    max = Math.max(max, samples[samples.length - 1].t)
  }
  return Number.isFinite(min) ? [min, max] : null
}
