# Asteria web app

Vite + React + TypeScript. Ranks lunar south pole landing sites by sunlight and
Earth visibility over a selected time period, using precomputed CSV data.

## Run

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # static site in dist/
pnpm mock-data    # regenerate synthetic data in public/data/
                  # (site coordinates = centers of ../data/A3_Named_regions_SP.geojson)
```

## Data

Everything lives in `public/data/` and is loaded in the browser; there is no backend.

`sites.json` lists the sites:

```json
{
  "sites": [
    { "id": "malapert-massif", "name": "Malapert Massif", "lat": -85.9, "lon": 0.0, "file": "malapert-massif.csv" }
  ]
}
```

Each site has one CSV in the Moon Trek export format. Required columns:
`UTC, SUN_VIS, SUN_ELE, SUN_AZMT, EARTH_VIS, EARTH_ELE, EARTH_AZMT`
(other columns are ignored). `*_VIS` is `1` when visible, `0` otherwise.

To switch to real data: drop the exported CSVs into `public/data/`, update
`sites.json`, and remove `"mock": true`.

## Structure

```
src/
  App.tsx                     state: time period, weighting, selected site
  types.ts
  lib/loadData.ts             fetch + parse sites.json and CSVs
  lib/metrics.ts              per-site stats for a time window, ranking
  lib/projection.ts           south polar stereographic projection
  components/
    TimeRangePicker.tsx
    WeightSlider.tsx
    RankingTable.tsx
    SouthPoleMap.tsx          SVG map; basemap image can be added later
scripts/generate-mock-data.mjs
```

## Ranking

For each site and the selected period, the share of time with the Sun visible
(`sun%`) and with the Earth visible (`earth%`) is computed, weighted by the
time between samples. Score = `w · sun% + (1 − w) · earth%`, where `w` is set
by the slider.

## Next ideas

- LROC/LOLA basemap image under the SVG map (same polar stereographic projection).
- Astronaut view: the CSVs already include Sun/Earth elevation and azimuth,
  which is what a first-person sky view at the selected site needs (e.g. three.js).
