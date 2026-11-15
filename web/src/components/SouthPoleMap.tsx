import { polarStereoSouth } from '../lib/projection'
import type { RankedSite } from '../types'

interface Props {
  ranked: RankedSite[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Outermost latitude shown on the map. */
const EDGE_LAT = -83.5
const LAT_RINGS = [-84, -86, -88]
const LON_SPOKES = Array.from({ length: 12 }, (_, i) => i * 30)

/** Map km -> SVG coordinates (SVG y points down). */
function project(lat: number, lon: number) {
  const { x, y } = polarStereoSouth(lat, lon)
  return { x, y: -y }
}

const EDGE_R = Math.abs(polarStereoSouth(EDGE_LAT, 0).y)
const PAD = 22

/**
 * South pole map in polar stereographic projection. For now it only draws a
 * graticule; an LROC/LOLA basemap image can later be added as an <image>
 * covering the same extent.
 */
export function SouthPoleMap({ ranked, selectedId, onSelect }: Props) {
  const top = ranked.find((r) => r.rank === 1)
  const view = EDGE_R + PAD

  return (
    <svg
      className="map"
      viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
      role="img"
      aria-label="Map of the lunar south pole with ranked landing sites"
    >
      <circle r={EDGE_R} className="map-disc" />

      {LAT_RINGS.map((lat) => {
        const r = Math.abs(polarStereoSouth(lat, 0).y)
        // Label between two spokes so it doesn't collide with longitude labels.
        const label = project(lat, 165)
        return (
          <g key={lat}>
            <circle r={r} className="graticule" />
            <text x={label.x} y={label.y} className="graticule-label centered">
              {Math.abs(lat)}°S
            </text>
          </g>
        )
      })}

      {LON_SPOKES.map((lon) => {
        const end = project(EDGE_LAT, lon)
        const label = project(EDGE_LAT - 0.55, lon)
        return (
          <g key={lon}>
            <line x1={0} y1={0} x2={end.x} y2={end.y} className="graticule" />
            <text x={label.x} y={label.y} className="graticule-label centered">
              {lon === 0 || lon === 180 ? `${lon}°` : lon < 180 ? `${lon}°E` : `${360 - lon}°W`}
            </text>
          </g>
        )
      })}

      <circle r={2.5} className="pole" />

      {/* Draw in reverse rank order so the top site is painted last (on top). */}
      {[...ranked].reverse().map((r) => {
        const p = project(r.site.lat, r.site.lon)
        const isTop = r === top
        const isSelected = r.site.id === selectedId
        const noData = r.rank === null
        return (
          <g
            key={r.site.id}
            transform={`translate(${p.x} ${p.y})`}
            className={`site${isTop ? ' top' : ''}${isSelected ? ' selected' : ''}${noData ? ' no-data' : ''}`}
            onClick={() => onSelect(r.site.id)}
          >
            <title>
              {noData
                ? `${r.site.name} (no data)`
                : `#${r.rank} ${r.site.name} (score ${r.score.toFixed(1)})`}
            </title>
            {isTop && <circle r={13} className="top-halo" />}
            <circle r={isTop ? 8 : noData ? 4 : 6} className="marker" />
            {!noData && (
              <text className="marker-rank" dy="0.35em">
                {r.rank}
              </text>
            )}
            {(isTop || isSelected) && (
              <text className="marker-name" x={12} dy="0.35em">
                {r.site.name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
