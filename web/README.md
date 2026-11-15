# Asteria web app

Vite + React + TypeScript. Ranks lunar south pole landing sites by sunlight and
Earth visibility over a selected time period, using precomputed CSV data.

## Run

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # static site in dist/
pnpm prepare-data   # rebuild public/data/ only (dev and build run this automatically)
```

## Data

The source data lives in the repo's `data/` folder; `scripts/prepare-data.mjs`
turns it into `public/data/` (generated, not committed):

- `data/A3_Named_regions_SP.geojson`: the 13 Artemis III candidate regions.
  Each site is placed at the center of its polygon.
- `data/landing-sites/<site-id>.csv`: precomputed visibility for one site, in the
  Moon Trek export format. Sites without a CSV are shown but not ranked.
  The script warns if a CSV's camera position is more than 1 km from the
  region center.

Site ids are the names in lowercase with dashes, e.g. `malapert-massif.csv`,
`de-gerlache-rim-1.csv`, `peak-near-shackleton.csv`.

Required CSV columns: `UTC, CAMERA_LAT, CAMERA_LON, CAMERA_HEIGHT, SUN_VIS, SUN_ELE,
SUN_AZMT, EARTH_VIS, EARTH_ELE, EARTH_AZMT` (others are ignored). `*_VIS` is `1`
when visible. Note that Moon Trek's `CAMERA_HEIGHT` is measured from the
1737.4 km reference sphere, not from the ground: use ground height + 10 m.

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
scripts/prepare-data.mjs     data/ -> public/data/
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
