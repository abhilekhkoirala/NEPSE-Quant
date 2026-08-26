# Frontend Redesign Notes

Visual/UX redesign of `frontend/` only. Nothing in `backend/` changed —
no calculations, signal formulas, regime logic, or API contracts were
touched. Every component's props and data flow are unchanged; only
internal styling, layout, and copy changed. `npm run build` passes
cleanly.

## What changed

**Design tokens** (`frontend/src/components/common/theme.js`,
`frontend/src/index.css`) — the whole visual system now comes from one
place:
- Charcoal surfaces (`#0D0F12` / `#14171B` / `#191C21`), not black.
- Inter for all UI text; IBM Plex Mono reserved for tickers, prices,
  percentages, and other figures — no more monospace-everywhere.
- One interactive accent (blue). Green/red/amber are reserved for
  gain/loss/warning and nothing else — the old gold/mint/purple/teal
  accent mix (used almost decoratively for tickers, selection states,
  slider colors, regime badges) is gone.
- A 4/8/12/16/24/32/40/48 spacing scale, 4–8px radii, normal case and
  normal letter-spacing throughout (no more uppercase-and-tracked
  labels except the two small sidebar group headers).
- A dedicated muted categorical palette for sectors, kept deliberately
  outside the gain/loss/warning/accent hues so a sector tag is never
  visually confused with a signal.

**New shared primitives** — `MetricCard`/`MetricRow` (replaces
duplicated metric-card markup that used to be hand-copied into four
different tabs), `EmptyState`, and a small hand-drawn icon set for the
sidebar (no new dependency).

**Shell** (`App.jsx`) — sidebar nav now shows full readable labels with
icons, grouped into Markets / Portfolio, instead of 3-letter codes.
Header shows a page title + one-line description instead of a code
badge. The nav footer no longer claims "LIVE" (this is a backtest/
research tool, not a streaming feed) — it just states the tracked
ticker count. The Market Data panel shows the real `computedAt`
timestamp from the backend instead of a fabricated "updated" claim.

**Every tab** — Backtest Results was restructured around three large
headline metrics + a full-width equity chart + a compact risk-metrics
grid (previously two cramped side-by-side panels). Strategy Parameters
dropped the fake "v6.0" version tag and the red/gold/mint preset
buttons (color implied risk-good/bad where none was intended) in favor
of a neutral segmented control, and fixed a slider display bug where
raw fractional values (e.g. `0.3`) were shown redundantly next to an
already-formatted percentage in the label. The signature Regime
Terrain visualization now renders in the app's own accent color
instead of a one-off cream tone used nowhere else in the system.

## Running it

Unchanged from before — see `README.md`. From the repo root:

```bash
cd backend && npm install && npm start      # http://localhost:3001
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Worth knowing

- No API gaps were found — every field this redesign displays was
  already available in the composed `result` object.
- Portfolio CSV upload now supports drag-and-drop in addition to the
  file picker (same upload endpoint, presentation-only change).
- The fundamentals lookup error state (merolagani.com unreachable) now
  has a Retry button.
