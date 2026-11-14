import type { RankedSite } from '../types'

interface Props {
  ranked: RankedSite[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function PctCell({ value, kind }: { value: number; kind: 'sun' | 'earth' | 'both' }) {
  return (
    <td className="pct">
      <div className="bar">
        <div className={`bar-fill ${kind}`} style={{ width: `${value}%` }} />
      </div>
      <span>{value.toFixed(1)}%</span>
    </td>
  )
}

export function RankingTable({ ranked, selectedId, onSelect }: Props) {
  return (
    <div className="table-wrap">
      <table className="ranking">
        <thead>
          <tr>
            <th>#</th>
            <th>Site</th>
            <th>Score</th>
            <th>Sun</th>
            <th>Earth</th>
            <th>Both</th>
            <th title="Longest continuous period without sunlight">Longest dark</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr
              key={r.site.id}
              className={r.site.id === selectedId ? 'selected' : undefined}
              onClick={() => onSelect(r.site.id)}
            >
              <td className="rank">{r.rank}</td>
              <td>{r.site.name}</td>
              <td className="score">{r.sampleCount > 0 ? r.score.toFixed(1) : '—'}</td>
              <PctCell value={r.sunPct} kind="sun" />
              <PctCell value={r.earthPct} kind="earth" />
              <PctCell value={r.bothPct} kind="both" />
              <td className="num">{r.longestDarkHours.toFixed(0)} h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
