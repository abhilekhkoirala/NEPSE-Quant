// News feed + the market-wide news-sentiment regime scaler. The
// per-ticker sentiment overlay itself is applied inside the pipeline (see
// quant/newsSentiment.js) — this just serves the raw feed and the
// computed scale factor for display.
import { Router } from "express";
import { asyncRoute, sendError } from "./_utils.js";
import { loadNews } from "../services/newsService.js";
import { getCurrent } from "../services/pipelineService.js";
import { runNewsOnlyRefresh, isNewsScraperRunning } from "../services/dataService.js";

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

// POST /api/news/refresh — runs just scrape_news.py (skips the much
// slower price/sector pass in scrape_nepse.py). For refreshing the news
// feed on its own without waiting on a full ~300-ticker price re-scrape.
router.post("/refresh", asyncRoute(async (req, res) => {
  const result = await runNewsOnlyRefresh();
  if (result === "already_running") {
    return sendError(res, 409, "ALREADY_RUNNING", "News refresh is already running, please wait.");
  }
  res.json({ ok: true });
}));

// GET /api/news/refresh-status
router.get("/refresh-status", (req, res) => {
  res.json({ running: isNewsScraperRunning() });
});

export default router;
