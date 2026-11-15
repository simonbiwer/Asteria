import { polarStereoSouth } from '../lib/projection'
import type { RankedSite, Site } from '../types'

/** e.g. "87.10°S 82.00°E · 2.0 m above surface" */
function formatLocation({ lat, lon, heightM }: Site): string {
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}`
  const lonNorm = ((((lon + 180) % 360) + 360) % 360) - 180
  const lonStr =
    lonNorm === 0 || Math.abs(lonNorm) === 180
      ? `${Math.abs(lonNorm).toFixed(2)}°`
      : `${Math.abs(lonNorm).toFixed(2)}°${lonNorm > 0 ? 'E' : 'W'}`
  const heightStr = heightM === undefined ? '' : ` · ${heightM.toFixed(1)} m above surface`
  return `${latStr} ${lonStr}${heightStr}`
}

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
 * Surface image, already reprojected to this map's projection by
 * scripts/reproject-basemap.py. It is a square centred on the pole whose
 * edges lie at BASEMAP_EDGE_LAT (must match OUT_EDGE_LAT in that script).
 */
const BASEMAP_URL = `${import.meta.env.BASE_URL}basemap/south-pole-clementine.jpg`
const BASEMAP_EDGE_LAT = -83
const BASEMAP_R = Math.abs(polarStereoSouth(BASEMAP_EDGE_LAT, 0).y)

/** South pole map in polar stereographic projection over a Clementine mosaic. */
export function SouthPoleMap({ ranked, selectedId, onSelect }: Props) {
  const top = ranked[0]
  const view = EDGE_R + PAD

  return (
    <svg
      className="map"
      viewBox={`${-view} ${-view} ${2 * view} ${2 * view}`}
      role="img"
      aria-label="Map of the lunar south pole with ranked landing sites"
    >
      <defs>
        <clipPath id="map-disc-clip">
          <circle r={EDGE_R} />
        </clipPath>
      </defs>

      <circle r={EDGE_R} className="map-disc" />
      <image
        href={BASEMAP_URL}
        x={-BASEMAP_R}
        y={-BASEMAP_R}
        width={2 * BASEMAP_R}
        height={2 * BASEMAP_R}
        clipPath="url(#map-disc-clip)"
        className="basemap"
      />
      <circle r={EDGE_R} className="map-outline" />

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

      {/* Paint the top site last (on top), and the selected site above even that. */}
      {[...ranked]
        .reverse()
        .sort((a, b) => Number(a.site.id === selectedId) - Number(b.site.id === selectedId))
        .map((r) => {
          const p = project(r.site.lat, r.site.lon)
          const isTop = r === top
          const isSelected = r.site.id === selectedId
          const location = formatLocation(r.site)
          // Put labels on the side facing the map centre so they don't run off the edge.
          const labelLeft = p.x > 0
          const labelX = labelLeft ? -12 : 12
          return (
            <g
              key={r.site.id}
              transform={`translate(${p.x} ${p.y})`}
              className={`site${isTop ? ' top' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => onSelect(r.site.id)}
            >
              <title>{`#${r.rank} ${r.site.name} (score ${r.score.toFixed(1)})\n${location}`}</title>
              {isTop && <circle r={13} className="top-halo" />}
              <circle r={isTop ? 8 : 6} className="marker" />
              <text className="marker-rank" dy="0.35em">
                {r.rank}
              </text>
              {(isTop || isSelected) && (
                <text
                  className="marker-name"
                  x={labelX}
                  dy="-0.15em"
                  textAnchor={labelLeft ? 'end' : 'start'}
                >
                  {r.site.name}
                  <tspan className="marker-location" x={labelX} dy="1.2em">
                    {location}
                  </tspan>
                </text>
              )}
            </g>
          )
        })}
    </svg>
  )
}
