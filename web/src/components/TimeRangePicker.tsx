interface Props {
  from: number
  to: number
  min: number
  max: number
  onChange: (from: number, to: number) => void
}

/** <input type="datetime-local"> works in local time; we show and parse UTC. */
const toInput = (ms: number) => new Date(ms).toISOString().slice(0, 16)
const fromInput = (value: string) => Date.parse(`${value}:00Z`)

export function TimeRangePicker({ from, to, min, max, onChange }: Props) {
  return (
    <fieldset className="control">
      <legend>Time period (UTC)</legend>
      <div className="time-inputs">
        <label>
          From
          <input
            type="datetime-local"
            value={toInput(from)}
            min={toInput(min)}
            max={toInput(to)}
            onChange={(e) => {
              const t = fromInput(e.target.value)
              if (!Number.isNaN(t)) onChange(Math.max(min, Math.min(t, to)), to)
            }}
          />
        </label>
        <label>
          To
          <input
            type="datetime-local"
            value={toInput(to)}
            min={toInput(from)}
            max={toInput(max)}
            onChange={(e) => {
              const t = fromInput(e.target.value)
              if (!Number.isNaN(t)) onChange(from, Math.min(max, Math.max(t, from)))
            }}
          />
        </label>
        <button type="button" onClick={() => onChange(min, max)}>
          Full range
        </button>
      </div>
    </fieldset>
  )
}
