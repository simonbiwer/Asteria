interface Props {
  /** 0 = only Earth visibility counts, 1 = only sunlight counts. */
  sunWeight: number
  onChange: (sunWeight: number) => void
}

export function WeightSlider({ sunWeight, onChange }: Props) {
  const sunPct = Math.round(sunWeight * 100)
  return (
    <fieldset className="control">
      <legend>Weighting</legend>
      <div className="weight-slider">
        <span className="earth">Earth {100 - sunPct}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={sunPct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="Weight of sunlight versus Earth visibility"
        />
        <span className="sun">Sun {sunPct}%</span>
      </div>
    </fieldset>
  )
}
