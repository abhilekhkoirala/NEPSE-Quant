# Frontend / Backend Separation — Refactor Notes

## 0. Audit summary

Before touching anything: the app was a single 3,592-line `src/App.jsx`
(Vite + React 19, no router, no state library) plus a 200-line Express
`server.js` that did almost nothing but serve static CSV/JSON files, run
three standalone Python scrapers as subprocesses, proxy Gemini, and cache
an IPO JSON file. There was no database anywhere — everything is
file-based (CSV/JSON on disk). There was no real auth. **All quantitative
computation — correlation, the ensemble/topology signal, regime/homology
detection, walk-forward backtesting, portfolio weight construction, Monte
Carlo projections, IPO scoring, tax/cost modeling — ran in the browser**,
including on every keystroke-adjacent render (the regime-terrain MDS
embedding and density field were recomputed from scratch by a React
component on every render). The "backend" never computed anything; it
just handed the browser raw CSVs to parse and crunch itself.

Three issues turned up during the audit that are fixed as part of this
pass, not left in place, because leaving them would mean baking a broken
or insecure pattern into the new architecture:

- **An exposed API key.** `.env` held `VITE_GEMINI_API_KEY` — the
  `VITE_` prefix means Vite bundles it straight into the shipped client
  JS. Anyone who opened dev tools on a built copy of the site could read
  it. It also happened to be a dead variable: `server.js`'s Gemini proxy
  reads the unprefixed `GEMINI_API_KEY`, which was never set anywhere, so
  the AI Analyst proxy was likely non-functional even before this
  refactor. **Rotate that key** — treat it as compromised regardless of
  whether it was ever committed to source control, since it was shared in
  a plaintext `.env`.
- **The daily scraper never actually refreshed prices.** `server.js`'s
  `SCRAPER_FILE` constant pointed at `scrape_news.py` (news-only) instead
  of `scrape_nepse.py` (prices + sectors + news). The manual "refresh"
  button and the 4pm-NPT scheduler were both silently re-scraping news
  only; the price CSV would only ever update if someone separately ran
  `scrape_nepse.py` by hand. Fixed in `backend/src/services/dataService.js`.
- **Wide-open CORS.** The old server echoed back whatever `Origin` header
  it received (`res.header("Access-Control-Allow-Origin", origin || "*")`),
  which is functionally "allow any origin," not just permissive-by-default
  for local dev. Replaced with a real allowlist
  (`FRONTEND_ORIGIN` env var) in `backend/src/app.js`, per the brief's own
  CORS guidance.

Two direct-from-browser fetches to `merolagani.com` (in the Fundamentals
panel and Bridge Trades) were also found — these are why the UI carried a
"Could not reach merolagani.com (CORS or network)" error string. Both are
now server-side calls (`backend/src/data/externalFetch.js`), which
removes the CORS fragility as a side effect of the architectural move.

## 1. New project structure

```
NEPSE_trading_bot/
├── README.md                  ← run instructions
├── REFACTOR_NOTES.md          ← this file
├── package.json                ← root convenience: `npm run dev` runs both
│
├── backend/
│   ├── server.js               ← entry point
│   ├── package.json / .env
│   ├── data/                    ← nepse_prices.csv, nepse_sectors.csv,
│   │                              nepse_news.json, ipo_data.json,
│   │                              portfolio.csv, SEBON_IPO.pdf
│   ├── scrapers/                ← scrape_nepse.py, scrape_news.py,
│   │                              scrape_ipo.py (unchanged)
│   └── src/
│       ├── app.js                ← Express app assembly, CORS, error handler
│       ├── config/constants.js   ← EWMA_LAMBDA, DEFAULT_PARAMS, CGT rates…
│       ├── quant/                 ← the entire quantitative engine
│       │   ├── random.js, correlation.js, signals.js, regime.js,
│       │   ├── portfolioWeights.js, backtest.js, costs.js,
│       │   ├── newsSentiment.js, projections.js, ipoScoring.js,
│       │   └── portfolioTools.js  ← Optimal Holdings / Cash Allocator /
│       │                            Bridge Trades math (was in React components)
│       ├── data/                  ← csv.js (parsing + synthetic fallback),
│       │                            externalFetch.js (merolagani), ipoDefaults.js
│       ├── services/              ← pipelineService, dataService, newsService,
│       │                            ipoService, portfolioService, geminiService
│       └── api/                   ← stocks, signals, regime, backtests,
│                                     portfolio, news, ipos, ai (Express routers)
│
└── frontend/
    ├── index.html / vite.config.js / package.json / .env
    └── src/
        ├── App.jsx                 ← shell: nav, layout, API-driven state
        ├── main.jsx / index.css
        ├── lib/
        │   ├── api/                 ← client.js + one thin module per domain
        │   └── utilities/useIsMobile.js
        ├── components/
        │   ├── layout/ (Panel, SL, Loading)
        │   ├── navigation/ (NavItem)
        │   ├── forms/ (Slider)
        │   ├── charts/ (Heatmap, Sparkline, ProjectionChart, RegimeTerrain, Pipeline)
        │   └── common/ (theme.js, Stat, FlashCell, CollapsiblePanel)
        └── features/
            ├── overview/, signals/, regime/, backtests/,
            └── portfolio/, ipo/, ai/   ← one file per tab, roughly 1:1
                                          with the original tab components
```

## 2–3. What moved to the frontend vs. backend

**Frontend keeps:** all rendering, the tab shell/nav, chart components,
local UI state (search filters, selected row, collapsed panels, the
Parameters sliders' local draft state), the `lib/api/*` client, and one
deliberately-retained piece of client-side derived math: `RegimeTerrain`'s
edge-threshold filter (which pairs of already-fetched correlation values
are within ε — a presentation filter over data already being sent for the
Heatmap, not a modeling calculation) and `RegimeAlerts`' regime-transition
diff (a trivial scan over an already-computed series for display
grouping).

**Backend now owns everything else that used to run in the browser:**
correlation estimation, the ensemble/diffusion signal, momentum/reversion/
quality/liquidity/low-cap filters, regime detection (persistent homology,
β1), the classical-MDS + density-field terrain geometry (previously
recomputed by React on every render), walk-forward backtesting, portfolio
weight construction, the bootstrap risk band, 5-year Monte Carlo
projections, NEPSE transaction-cost/CGT modeling, news-sentiment overlay
and regime filter, IPO scoring, CSV parsing, the merolagani fallback
fetch, and the Gemini system-context assembly.

Also moved, because they were "quantitative/portfolio logic living inside
a React component" even though I hadn't originally scoped them as tightly
as the core signal engine: the **Optimal Holdings** target-allocation math,
**Cash Allocator**'s momentum-blended scoring + position-cap iteration, and
**Bridge Trades**' rebalancing-diff calculation — all previously recomputed
in-browser against the *entire raw daily-returns matrix* on every render.
These are now `backend/src/quant/portfolioTools.js`, reused by three thin
service functions in `portfolioService.js`. This also fixed an existing
duplication bug: three separate, slightly-diverging copies of the same
`SYMBOL_ALIAS` / "resolve portfolio symbol → price" block (one each in
`OptimalHoldings`, `LiveMirror`, `PortfolioTab`) are now one function,
`resolvePortfolioHoldings`.

## 4. Quantitative logic extracted (verbatim — formulas unchanged)

Every function below was moved by extracting its exact original source
(not retyped/reimplemented) and was then **regression-tested**: I ran a
reconstruction of the original in-browser pipeline directly in Node
against the real bundled data (280 tickers, 1,820 days) and diffed its
output against the new backend's `pipelineService.runPipeline()` output.
They are byte-for-byte identical (same Sharpe 1.88, annRet 30.31%,
maxDD -14.86%, same top/bottom ranked signals, same correlation matrix,
same curve) — the only difference is an added `sparkline60` field, which
is new precomputed chart data, not a changed calculation.

`mkRng`, `generateData`, `parseSectorCSV`, `parseCSVData`, `corrGet`,
`corrMatEWMA`, `corrMatFromFlat`, `buildL`, `diffuse`, `ensembleSignal`,
`meanReversionSignal`, `momentumSignal`, `reversionSignal`,
`qualityFilter`, `liquidityFilter`, `lowCapFilter`, `stockVols`,
`estimateBetas`, `buildWeights`, `computeHomology`, `topoFeatures`,
`rollingRegime`, `buildRegimeMap`, `regimeScale`, `powerIterEig`,
`classicalMDS2D`, `densityField`, `walkForward`, `equityAtOrBefore`,
`bootstrapEquityBand`, `calcNEPSECost`, `applyNewsSentimentOverlay`,
`computeNewsSentimentRegimeScale`, `build5YearProjection`,
`buildEqualWeightProjection`, `scoreIPO`, `fetchMerolaganiPrice`,
`fetchMerolaganiProfile`.

## 5. API endpoints created

```
GET  /api/health

GET  /api/stocks                          GET  /api/stocks/:ticker
GET  /api/stocks/:ticker/history          GET  /api/stocks/:ticker/fundamentals
POST /api/stocks/refresh                  GET  /api/stocks/refresh-status

GET  /api/signals                         GET  /api/signals/:ticker

GET  /api/regime                          GET  /api/regime/history

POST /api/backtests                       GET  /api/backtests/current
GET  /api/backtests/current/risk-band

GET  /api/portfolio/holdings              POST /api/portfolio/upload
GET  /api/portfolio/optimal-holdings      POST /api/portfolio/cash-allocation
GET  /api/portfolio/bridge-trades

GET  /api/news                            GET  /api/news/sentiment

GET  /api/ipos                            GET  /api/ipos/:id
POST /api/ipos/refresh                    GET  /api/ipos/status
POST /api/ipos/scrape

POST /api/ai/analyze
```

Deviations from the brief's illustrative section-8 list, and why: no
`GET /api/portfolio/risk` — the app never had a distinct "risk" view
beyond the sector-concentration breakdown already inside
`optimal-holdings`, and the brief says not to invent endpoints for
functionality that doesn't exist. `/api/ipo` → `/api/ipos` (plural, per
the brief's own convention) and `/api/scrape` / `/api/scrape-status` →
`/api/stocks/refresh` / `/api/stocks/refresh-status` (scoped under the
resource they refresh, since "scrape" was really "refresh the price
data"). The old raw-CSV endpoints (`/api/csv`, `/api/sectors`) are gone
entirely — the frontend no longer parses CSVs, so there's nothing that
needs them.

Every response is a typed JSON shape (ticker/signal/regime objects, not a
dump of internal engine state), and every error is
`{ "error": { "code": "...", "message": "..." } }` — no stack traces or
Python tracebacks reach the client (see `backend/src/api/_utils.js`).

**Two real routing bugs were found and fixed during end-to-end testing** —
worth calling out because they're the kind of thing only a live HTTP test
catches, not a syntax check or a unit test of the pure functions: in both
`stocks.js` and `ipos.js`, a fixed path (`/refresh-status`, `/status`) was
originally registered *after* a `/:param` route, so Express matched the
param route first and the dedicated handler never ran. Fixed by
reordering (fixed paths before param routes) and confirmed via
`curl` against a live server.

## 6. Environment variables

**`backend/.env`** (secret, never sent to the browser):
`GEMINI_API_KEY`, `FRONTEND_ORIGIN`, `PORT`.

**`frontend/.env`** (safe to expose — just where the browser sends
requests): `VITE_API_BASE`.

`VITE_GEMINI_API_KEY` is gone. If you had it set anywhere for local dev,
delete it — do not move its value into `backend/.env`'s `GEMINI_API_KEY`
without rotating it first (see the audit summary above).

## 7. Database changes

None — there was no database before, and this pass doesn't introduce
one. All state is still the same on-disk CSV/JSON files, now living under
`backend/data/` instead of the repo root, loaded and cached in memory by
`dataService.js` / `pipelineService.js` for the life of the server
process.

## 8. Remaining architectural coupling

- **`generateData()`'s synthetic-data fallback no longer has anywhere to
  live on the client.** The original app could fall back to fully
  synthetic in-browser data if literally nothing else was reachable (no
  server, no static snapshot) — useful for the zero-backend GitHub Pages
  demo mode. Since the quant engine is now backend-only, that fallback
  either needs to stay backend-side (meaning a GH-Pages-style static
  deploy can no longer demo the app at all without *some* backend
  reachable) or a prebaked `results.json` snapshot needs to be generated
  and shipped alongside the existing `public/data/*.csv` snapshot files,
  refreshed whenever the maintainer wants to update the demo. I didn't
  build that snapshot pipeline in this pass — it's a reasonable next
  increment, but building it wasn't part of "establish the boundary,"
  and the old CSV-snapshot files are no longer consumed by anything (the
  frontend doesn't parse CSVs anymore), so they're currently unused. The
  new frontend instead shows a plain "backend unreachable" error state.
- **`RegimeTerrain`'s edge filter and `RegimeAlerts`' transition diff**
  remain client-side by design (see section 2) — flagged here in case a
  future stricter pass wants everything derived server-side regardless
  of cost.
- **`PortfolioUpload` still parses nothing client-side** (it just reads
  the file as text and posts it) — but the *default* portfolio.csv and
  *uploaded* portfolio CSVs now share one parser
  (`dataService.parsePortfolioCSV`), where before they were two
  independently-drifting implementations. Worth double-checking against
  a real broker export if yours uses a schema variant.
- **IPO scrape output contains raw HTML fragments** in some fields
  (`open_date`, `status`, etc. — e.g. `"<span class='no-wrap'>2026-06-17</span>"`)
  coming straight out of `scrape_ipo.py` / `ipo_data.json`. This is
  pre-existing (not introduced by this refactor, and not something the
  frontend previously cleaned up either), but it's now rendered as literal
  text in the IPO table's date/status columns — worth a follow-up pass on
  the scraper's own output cleaning.
- **The AI Analyst's Gemini call is a single non-streaming
  request/response** (`POST /api/ai/analyze`), same as the original —
  no change here, just noting it wasn't upgraded to streaming as part of
  this pass.

## 9. Running frontend and backend locally

See `README.md`. Short version: `cd backend && npm install && npm start`,
`cd frontend && npm install && npm run dev`, or `npm run dev` from the
repo root to run both.

## 10. Before the next phase (visual redesign)

- Generate the `results.json` snapshot (see section 8) if the zero-backend
  static demo mode needs to keep working.
- Rotate the Gemini key and confirm `backend/.env` has a real one before
  relying on the AI Analyst tab.
- The end-to-end HTTP test in this pass covered the primary path through
  every endpoint with real data, but not every parameter combination —
  worth adding a small automated test suite (even just a script that
  boots the server and curls each route) before the UI redesign starts
  changing things underneath it.
- Consider whether `backend/data/*.csv` should be gitignored (they're
  scraped/regenerable data, currently ~2.8MB for the price CSV alone) —
  left tracked for now since the original repo tracked them too.
