// News feed + the market-wide news-sentiment regime scaler. The
// per-ticker sentiment overlay itself is applied inside the pipeline (see
// quant/newsSentiment.js) — this just serves the raw feed and the
// computed scale factor for display.
import { Router } from "express";
import { sendError } from "./_utils.js";
import { loadNews } from "../services/newsService.js";
import { getCurrent } from "../services/pipelineService.js";

const router = Router();

// GET /api/news
router.get("/", (req, res) => {
  res.json(loadNews());
});

// GET /api/news/sentiment — the market-wide scale factor + label computed
// from the news feed during the last pipeline run.
router.get("/sentiment", (req, res) => {
  const result = getCurrent();
  if (!result) return sendError(res, 409, "NO_PIPELINE_RESULT", "Pipeline has not run yet — call POST /api/backtests first.");
  res.json(result.newsSentiment);
});

export default router;
