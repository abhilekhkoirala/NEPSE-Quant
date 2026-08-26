// Runs the full quant pipeline (signals + regime + walk-forward backtest +
// portfolio weights) with a given set of parameters, and serves the last
// run's backtest curve/metrics without recomputing. This is the
// POST-to-get-a-run_id / GET-the-result pattern the brief suggests
// (section 18) for a long-running computation — except here run_id isn't
// needed for polling, because the run itself is awaited synchronously
// (same as the original "RUN" button, which just showed a spinner while
// computeWithData() finished in the browser). It's kept as an id anyway so
// the frontend can tell whether the params it's looking at are stale.
import { Router } from "express";
import { asyncRoute, sendError } from "./_utils.js";
import { runPipeline, getCurrent } from "../services/pipelineService.js";
import { loadRaw } from "../services/dataService.js";
import { loadNews } from "../services/newsService.js";
import { DEFAULT_PARAMS, CGT_SHORT_TERM_RATE } from "../config/constants.js";
import { bootstrapEquityBand, equityAtOrBefore } from "../quant/backtest.js";

const router = Router();

// Per-period tax/cost breakdown (Estimated CGT overlay on top of the
// txn-cost-aware curve). Moved from the TaxCostBreakdown component — same
// formula, applied once here instead of recomputed on every render.
function withTaxBreakdown(periods, curve) {
  const rows = periods.map(p => {
    const eStart = equityAtOrBefore(curve, p.startDay);
    const eEnd = equityAtOrBefore(curve, p.endDay);
    const net = (eEnd.equity / eStart.equity - 1) * 100;
    const cgt = net > 0 ? net * CGT_SHORT_TERM_RATE : 0;
    const netOfTax = net - cgt;
    return { ...p, net, cgt, netOfTax };
  });
  const compound = key => rows.reduce((acc, r) => acc * (1 + r[key] / 100), 1);
  const totals = {
    gross: (compound("grossRet") - 1) * 100,
    net: (compound("net") - 1) * 100,
    netOfTax: (compound("netOfTax") - 1) * 100,
    totalTxCost: rows.reduce((a, r) => a + r.txCostFrac * 100, 0),
    totalCGT: rows.reduce((a, r) => a + r.cgt, 0),
  };
  return { rows, totals };
}

function shapeBacktestResponse(result) {
  const { rows, totals } = withTaxBreakdown(result.periods, result.curve);
  return {
    id: result.id,
    computedAt: result.computedAt,
    params: result.params,
    metrics: result.m,
    curve: result.curve,
    periods: rows,
    periodTotals: totals,
    cgtShortTermRate: CGT_SHORT_TERM_RATE,
    lastRegime: result.lastRegime,
  };
}

// POST /api/backtests — run the pipeline with the given params (or
// DEFAULT_PARAMS) against the currently loaded price data.
router.post("/", asyncRoute(async (req, res) => {
  const raw = loadRaw();
  if (!raw) return sendError(res, 404, "NO_DATA", "No price data loaded yet — call POST /api/stocks/refresh first.");
  const params = { ...DEFAULT_PARAMS, ...(req.body?.params || {}) };
  const news = loadNews();
  const result = await runPipeline(raw, params, news.items || []);
  res.json(shapeBacktestResponse(result));
}));

// GET /api/backtests/current — last computed run, no recompute.
router.get("/current", (req, res) => {
  const result = getCurrent();
  if (!result) return sendError(res, 409, "NO_PIPELINE_RESULT", "Pipeline has not run yet — call POST /api/backtests first.");
  res.json(shapeBacktestResponse(result));
});

// GET /api/backtests/current/risk-band — bootstrapped equity percentile
// band for the current run's curve (used by the equity chart's shaded
// confidence band). Split out from the main payload since it's a
// resample, not part of the deterministic backtest result.
router.get("/current/risk-band", (req, res) => {
  const result = getCurrent();
  if (!result) return sendError(res, 409, "NO_PIPELINE_RESULT", "Pipeline has not run yet — call POST /api/backtests first.");
  res.json({ band: bootstrapEquityBand(result.curve) });
});

export default router;
