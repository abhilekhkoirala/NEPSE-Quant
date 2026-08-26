// The user's uploaded (or default) holdings, and the three portfolio
// calculations that used to run inside React components: Optimal
// Holdings, Cash Allocator, and Bridge Trades (Live Mirror). See
// services/portfolioService.js for the orchestration and
// quant/portfolioTools.js for the actual formulas.
//
// The brief's example API (section 8) lists GET /api/portfolio/risk as an
// illustrative endpoint; the original app never had a distinct "risk"
// view beyond the sector-concentration breakdown already returned inside
// optimal-holdings, so that endpoint isn't added here (section 8: "do not
// create endpoints for features that do not exist yet").
import { Router } from "express";
import { asyncRoute, sendError } from "./_utils.js";
import {
  getHoldings, setPortfolioFromCSV, getOptimalHoldings,
  getCashAllocation, getBridgeTrades,
} from "../services/portfolioService.js";

const router = Router();

function handlePipelineError(err, res) {
  if (err.code === "NO_PIPELINE_RESULT") { sendError(res, 409, err.code, err.message); return true; }
  return false;
}

// GET /api/portfolio/holdings — current portfolio, priced.
router.get("/holdings", (req, res) => {
  try { res.json(getHoldings()); }
  catch (err) { if (!handlePipelineError(err, res)) throw err; }
});

// POST /api/portfolio/upload — body: { csv: "<raw portfolio CSV text>" }.
// Replaces the client-side PortfolioUpload parser (which used a weaker,
// non-quote-aware split(",")) with the same quote-aware parser the
// default portfolio.csv load path always used — see
// dataService.parsePortfolioCSV.
router.post("/upload", (req, res) => {
  const csv = req.body?.csv;
  if (typeof csv !== "string" || !csv.trim()) {
    return sendError(res, 400, "BAD_REQUEST", "Body must include a non-empty `csv` string.");
  }
  const holdings = setPortfolioFromCSV(csv);
  if (holdings.length === 0) {
    return sendError(res, 422, "UNPARSEABLE_CSV", "Could not find Scrip / Current Balance columns in that CSV.");
  }
  res.json({ ok: true, count: holdings.length });
});

// GET /api/portfolio/optimal-holdings
router.get("/optimal-holdings", (req, res) => {
  try { res.json(getOptimalHoldings()); }
  catch (err) { if (!handlePipelineError(err, res)) throw err; }
});

// POST /api/portfolio/cash-allocation — body: { cash, topN?, riskMode? }
router.post("/cash-allocation", (req, res) => {
  const { cash, topN, riskMode } = req.body || {};
  if (typeof cash !== "number" || !(cash > 0)) {
    return sendError(res, 400, "BAD_REQUEST", "Body must include a positive numeric `cash` amount.");
  }
  try { res.json(getCashAllocation({ cash, topN, riskMode })); }
  catch (err) { if (!handlePipelineError(err, res)) throw err; }
});

// GET /api/portfolio/bridge-trades
router.get("/bridge-trades", asyncRoute(async (req, res) => {
  try { res.json(await getBridgeTrades()); }
  catch (err) { if (!handlePipelineError(err, res)) throw err; }
}));

export default router;
