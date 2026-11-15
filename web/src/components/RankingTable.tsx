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
          {ranked.map((r) => {
            const classes = [
              r.site.id === selectedId && 'selected',
              r.rank === null && 'no-data',
            ].filter(Boolean)
            return (
              <tr
                key={r.site.id}
                className={classes.join(' ') || undefined}
                onClick={() => onSelect(r.site.id)}
              >
                <td className="rank">{r.rank ?? '–'}</td>
                <td>{r.site.name}</td>
                {r.rank === null ? (
                  <td colSpan={5} className="muted">
                    {r.site.file ? 'no data in selected period' : 'no data yet'}
                  </td>
                ) : (
                  <>
                    <td className="score">{r.score.toFixed(1)}</td>
                    <PctCell value={r.sunPct} kind="sun" />
                    <PctCell value={r.earthPct} kind="earth" />
                    <PctCell value={r.bothPct} kind="both" />
                    <td className="num">{r.longestDarkHours.toFixed(0)} h</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
