import type { RankedSite } from '../types'

interface Props {
  /** 0 = only Earth visibility counts, 1 = only sunlight counts. */
  sunWeight: number
  /** Top-ranked site, used as a worked example. */
  example?: RankedSite
  onClose: () => void
}

const pct = (w: number) => `${Math.round(w * 100)}%`

/** Explains how the ranking score is calculated, using the current weights. */
export function ScoreInfo({ sunWeight, example, onClose }: Props) {
  const earthWeight = 1 - sunWeight
  return (
    <div className="score-info" id="score-info" role="region" aria-label="How the score is calculated">
      <button type="button" className="score-info-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="score-info-formula">
        Score = <span className="sun">{pct(sunWeight)} × Sun</span> +{' '}
        <span className="earth">{pct(earthWeight)} × Earth</span>
      </p>
      <ul>
        <li>
          <strong className="sun">Sun</strong>: share of the selected time period in which the
          Sun is above the local horizon, including mountains and crater rims. This means
          solar power.
        </li>
        <li>
          <strong className="earth">Earth</strong>: share of the time in which the Earth is
          visible, so the site can communicate directly with Earth.
        </li>
        <li>
          The weights come from the <em>Weighting</em> slider. The score ranges from 0 to 100.
        </li>
        <li>
          <strong>Both</strong> and <strong>Longest dark</strong> are shown for context
          and do not affect the score.
        </li>
      </ul>
      {example && (
        <p className="score-info-example">
          Example, {example.site.name}: {sunWeight.toFixed(2)} × {example.sunPct.toFixed(1)} +{' '}
          {earthWeight.toFixed(2)} × {example.earthPct.toFixed(1)} ={' '}
          <strong>{example.score.toFixed(1)}</strong>
        </p>
      )}
    </div>
  )
}
