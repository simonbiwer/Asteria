import { useEffect, useMemo, useState } from 'react'
import { RankingTable } from './components/RankingTable'
import { SouthPoleMap } from './components/SouthPoleMap'
import { TimeRangePicker } from './components/TimeRangePicker'
import { WeightSlider } from './components/WeightSlider'
import { loadAll } from './lib/loadData'
import { computeStats, dataPeriods, dataTimeRange, rankSites } from './lib/metrics'
import type { DataPeriod } from './lib/metrics'
import type { Manifest, SiteData } from './types'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      manifest: Manifest
      data: SiteData[]
      range: [number, number]
      periods: DataPeriod[]
    }

const formatDay = (t: number) => new Date(t).toISOString().slice(0, 10)

export default function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [period, setPeriod] = useState<[number, number] | null>(null)
  const [sunWeight, setSunWeight] = useState(0.5)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
      .then(({ manifest, data }) => {
        const range = dataTimeRange(data)
        if (!range) throw new Error('The CSV files contain no valid rows.')
        setLoad({ status: 'ready', manifest, data, range, periods: dataPeriods(data) })
        setPeriod(range)
      })
      .catch((e: unknown) =>
        setLoad({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      )
  }, [])

  const stats = useMemo(() => {
    if (load.status !== 'ready' || !period) return []
    return load.data.map((d) => computeStats(d, period[0], period[1]))
  }, [load, period])

  const ranked = useMemo(() => rankSites(stats, sunWeight), [stats, sunWeight])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Asteria</h1>
        <p>Ranking lunar south pole landing sites by sunlight and line of sight to Earth.</p>
      </header>

      {load.status === 'loading' && <p className="status">Loading visibility data…</p>}
      {load.status === 'error' && (
        <p className="status error">Failed to load data: {load.message}</p>
      )}

      {load.status === 'ready' && period && (
        <>
          {(() => {
            const total = load.manifest.sites.length
            const withData = load.manifest.sites.filter((s) => s.file).length
            return (
              withData < total && (
                <p className="banner">
                  Visibility data available for <strong>{withData} of {total}</strong> sites.
                  Sites without data are shown but not ranked.
                </p>
              )
            )
          })()}

          {load.periods.length > 1 && (
            <div className="banner warn">
              <strong>Sites were computed for different time periods</strong>, so the ranking
              compares different lighting conditions. Re-export all sites for the same period.
              <ul>
                {load.periods.map((p) => (
                  <li key={p.from}>
                    {formatDay(p.from)} – {formatDay(p.to)}: {p.siteNames.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="controls">
            <TimeRangePicker
              from={period[0]}
              to={period[1]}
              min={load.range[0]}
              max={load.range[1]}
              onChange={(from, to) => setPeriod([from, to])}
            />
            <WeightSlider sunWeight={sunWeight} onChange={setSunWeight} />
          </section>

          <main className="content">
            <section className="panel map-panel">
              <h2>South pole</h2>
              <SouthPoleMap ranked={ranked} selectedId={selectedId} onSelect={setSelectedId} />
              <p className="map-credit">Surface: Clementine uncontrolled mosaic (NASA/USGS)</p>
            </section>
            <section className="panel">
              <h2>Ranking</h2>
              <RankingTable ranked={ranked} selectedId={selectedId} onSelect={setSelectedId} />
            </section>
          </main>
        </>
      )}
    </div>
  )
}
