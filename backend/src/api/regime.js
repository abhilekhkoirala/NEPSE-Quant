// Market regime data — the Regime tab. The rolling regime series, the
// homology (β1 persistence) curve, and the precomputed regime-terrain
// geometry (classical-MDS point cloud + density field) that used to be
// recalculated in the browser on every render (see RegimeTerrain in the
// original src/App.jsx) — now computed once per pipeline run in
// pipelineService.js.
import { Router } from "express";
import { sendError } from "./_utils.js";
import { getCurrent } from "../services/pipelineService.js";

const router = Router();

function requireCurrent(res) {
  const result = getCurrent();
  if (!result) { sendError(res, 409, "NO_PIPELINE_RESULT", "Pipeline has not run yet — call POST /api/backtests first."); return null; }
  return result;
}

// GET /api/regime — current regime, correlation matrix (for the
// Heatmap chart), homology curve, and terrain geometry.
router.get("/", (req, res) => {
  const result = requireCurrent(res); if (!result) return;
  res.json({
    asOf: result.computedAt,
    lastRegime: result.lastRegime,
    tickers: result.tickers,
    corr: Array.from(result.corr),
    homoData: result.homoData,
    terrain: result.terrain,
  });
});

// GET /api/regime/history — the rolling regime series over time (chart
// data for the Regime tab's history view).
router.get("/history", (req, res) => {
  const result = requireCurrent(res); if (!result) return;
  res.json({ regimeSeries: result.regimeSeries });
});

export default router;
