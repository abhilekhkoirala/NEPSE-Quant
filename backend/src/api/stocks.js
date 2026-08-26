// Ticker universe + per-ticker price data, and the manual/scheduled price
// scrape trigger. Replaces the old GET /api/csv, GET /api/sectors
// (raw-CSV, browser-parses-it) endpoints — the frontend no longer parses
// CSVs itself, so these are shaped as ticker/price data instead.
import { Router } from "express";
import { asyncRoute, sendError } from "./_utils.js";
import { loadRaw, runScraper, isScraperRunning } from "../services/dataService.js";
import { getLastScheduledScrape } from "../workers/scheduler.js";
import { getCurrent } from "../services/pipelineService.js";
import { fetchMerolaganiProfileCached } from "../data/externalFetch.js";

const router = Router();

function requireRaw(res) {
  const raw = loadRaw();
  if (!raw) { sendError(res, 404, "NO_DATA", "No price data loaded yet — call POST /api/stocks/refresh."); return null; }
  return raw;
}

// GET /api/stocks — ticker universe with latest price + sector. If a
// pipeline run has already happened this session, the signal/weight for
// each ticker is included too (same data the Signals tab uses).
router.get("/", (req, res) => {
  const raw = requireRaw(res); if (!raw) return;
  const current = getCurrent();
  const signalByTicker = current ? Object.fromEntries(current.signalData.map(d => [d.ticker, d])) : {};
  const stocks = raw.tickers.map((t, i) => ({
    ticker: t,
    sector: raw.sectorNames[raw.sectors[i]] ?? "Other",
    price: raw.lastPrices ? raw.lastPrices[i] : null,
    signal: signalByTicker[t]?.signal ?? null,
    weight: signalByTicker[t]?.weight ?? null,
  }));
  res.json({ asOf: current?.computedAt ?? null, sectorNames: raw.sectorNames, count: stocks.length, stocks });
});

// Fixed-path routes (/refresh, /refresh-status) must be registered before
// the /:ticker catch-all below — otherwise Express matches
// "/refresh-status" as ticker="refresh-status" and the dedicated handler
// never runs. (Same class of bug as ipos.js — caught by the end-to-end
// HTTP test, not by any syntax-level check.)

// POST /api/stocks/refresh — manual scrape trigger (was POST /api/scrape).
router.post("/refresh", asyncRoute(async (req, res) => {
  try {
    await runScraper();
    res.json({ ok: true });
  } catch (err) {
    if (err.message === "already_running") return sendError(res, 409, "ALREADY_RUNNING", "Scraper is already running, please wait.");
    throw err;
  }
}));

// GET /api/stocks/refresh-status — was GET /api/scrape-status.
router.get("/refresh-status", (req, res) => {
  const nepalMs = Date.now() + (5 * 60 + 45) * 60 * 1000;
  res.json({
    running: isScraperRunning(),
    lastScheduledScrape: getLastScheduledScrape(),
    serverTime: new Date(nepalMs).toISOString().replace("T", " ").slice(0, 16) + " NPT",
  });
});

// GET /api/stocks/:ticker — must come after the fixed paths above.
router.get("/:ticker", (req, res) => {
  const raw = requireRaw(res); if (!raw) return;
  const ticker = req.params.ticker.toUpperCase();
  const i = raw.tickers.indexOf(ticker);
  if (i === -1) return sendError(res, 404, "NOT_FOUND", `Unknown ticker ${ticker}`);
  const current = getCurrent();
  const signal = current?.signalData.find(d => d.ticker === ticker) ?? null;
  res.json({
    ticker,
    sector: raw.sectorNames[raw.sectors[i]] ?? "Other",
    price: raw.lastPrices ? raw.lastPrices[i] : null,
    signal: signal?.signal ?? null,
    weight: signal?.weight ?? null,
  });
});

// GET /api/stocks/:ticker/history — the raw daily return series for one
// ticker (chart data for the frontend to plot; not recomputation).
router.get("/:ticker/history", (req, res) => {
  const raw = requireRaw(res); if (!raw) return;
  const ticker = req.params.ticker.toUpperCase();
  const i = raw.tickers.indexOf(ticker);
  if (i === -1) return sendError(res, 404, "NOT_FOUND", `Unknown ticker ${ticker}`);
  res.json({ ticker, nD: raw.nD, returns: raw.returns[i] });
});

// GET /api/stocks/:ticker/fundamentals — merolagani fallback profile
// (price / P/E / ROE). Moved from the browser-side fetchMerolaganiProfile
// call in FundamentalsPanel — same request, run server-side so it isn't
// subject to browser CORS, and cached (see data/externalFetch.js).
router.get("/:ticker/fundamentals", asyncRoute(async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const profile = await fetchMerolaganiProfileCached(ticker);
  if (!profile) return sendError(res, 502, "FUNDAMENTALS_UNAVAILABLE", `Could not reach merolagani.com for ${ticker}.`);
  res.json({ ticker, ...profile });
}));

export default router;
