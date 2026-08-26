// Ensemble signal data — the Signals tab. Requires a pipeline run (POST
// /api/backtests) since the signal only exists as part of that run's
// output.
import { Router } from "express";
import { sendError } from "./_utils.js";
import { getCurrent } from "../services/pipelineService.js";

const router = Router();

function requireCurrent(res) {
  const result = getCurrent();
  if (!result) { sendError(res, 409, "NO_PIPELINE_RESULT", "Pipeline has not run yet — call POST /api/backtests first."); return null; }
  return result;
}

// GET /api/signals — full ranked signal list + prevSignals (for the ΔSIG
// column the Signals tab shows against the previous run).
router.get("/", (req, res) => {
  const result = requireCurrent(res); if (!result) return;
  res.json({ asOf: result.computedAt, signalData: result.signalData, prevSignals: result.prevSignals });
});

// GET /api/signals/:ticker
router.get("/:ticker", (req, res) => {
  const result = requireCurrent(res); if (!result) return;
  const ticker = req.params.ticker.toUpperCase();
  const d = result.signalData.find(x => x.ticker === ticker);
  if (!d) return sendError(res, 404, "NOT_FOUND", `No signal for ${ticker}`);
  res.json({ ...d, prevSignal: result.prevSignals[ticker] ?? null });
});

export default router;
