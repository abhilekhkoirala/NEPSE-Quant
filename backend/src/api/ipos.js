// IPO/FPO pipeline. Each listing is scored (0-100) against the current
// signal/regime data — moved from the client-side scoreIPO() call in the
// IPOTab component, now computed once here.
import { Router } from "express";
import { asyncRoute, sendError } from "./_utils.js";
import { loadIpoData, refreshCache, getStatus, runIpoScraper } from "../services/ipoService.js";
import { getCurrent } from "../services/pipelineService.js";
import { scoreIPO } from "../quant/ipoScoring.js";

const router = Router();

function scoredList() {
  const ipos = loadIpoData();
  const result = getCurrent(); // scoreIPO degrades gracefully if this is null
  return ipos.map(ipo => ({ ...ipo, score: scoreIPO(ipo, result) }));
}

// GET /api/ipos
router.get("/", (req, res) => {
  res.json({ items: scoredList() });
});

// Fixed-path routes (/refresh, /status, /scrape) must be registered
// before the /:id catch-all below — otherwise Express matches them as
// id="refresh" etc. and the dedicated handler never runs (caught by the
// end-to-end HTTP test, not by any syntax-level check).

// POST /api/ipos/refresh — bust cache, reload ipo_data.json from disk.
router.post("/refresh", (req, res) => {
  const data = refreshCache();
  res.json({ ok: true, count: data.length });
});

// GET /api/ipos/status
router.get("/status", (req, res) => {
  res.json(getStatus());
});

// POST /api/ipos/scrape — run scrape_ipo.py on demand.
router.post("/scrape", asyncRoute(async (req, res) => {
  try {
    const data = await runIpoScraper();
    res.json({ ok: true, count: data.length });
  } catch (err) {
    if (err.code === "ALREADY_RUNNING") return sendError(res, 409, err.code, err.message);
    throw err;
  }
}));

// GET /api/ipos/:id — must come after the fixed paths above.
router.get("/:id", (req, res) => {
  const ipo = scoredList().find(x => String(x.id) === req.params.id || x.symbol === req.params.id.toUpperCase());
  if (!ipo) return sendError(res, 404, "NOT_FOUND", `No IPO with id/symbol ${req.params.id}`);
  res.json(ipo);
});

export default router;
