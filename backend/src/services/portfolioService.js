// The user's holdings (uploaded portfolio.csv override, or the bundled
// default) plus the three portfolio-facing calculations that used to live
// inside React components: Optimal Holdings, Cash Allocator, and Bridge
// Trades (Live Mirror). See quant/portfolioTools.js for the actual
// formulas — this module supplies them with the current pipeline result
// and current holdings, and (for Bridge Trades) resolves any prices
// missing from the CSV via the merolagani fallback before handing off to
// the pure calculation.
import { getCurrent } from "./pipelineService.js";
import { loadDefaultPortfolio, parsePortfolioCSV } from "./dataService.js";
import { fetchMerolaganiProfileCached } from "../data/externalFetch.js";
import { buildOptimalHoldings, buildCashAllocation, buildBridgeTrades, resolvePortfolioHoldings } from "../quant/portfolioTools.js";
import { build5YearProjection, buildEqualWeightProjection } from "../quant/projections.js";

let _currentPortfolio = null; // null => fall back to backend/data/portfolio.csv

function getCurrentPortfolio() {
  if (_currentPortfolio) return _currentPortfolio;
  return loadDefaultPortfolio();
}

function setPortfolioFromCSV(csvText) {
  _currentPortfolio = parsePortfolioCSV(csvText);
  return _currentPortfolio;
}

function requirePipeline() {
  const result = getCurrent();
  if (!result) {
    const err = new Error("Pipeline has not run yet — call POST /api/backtests first.");
    err.code = "NO_PIPELINE_RESULT";
    throw err;
  }
  return result;
}

function getHoldings() {
  const result = requirePipeline();
  const portfolio = getCurrentPortfolio();
  const resolved = resolvePortfolioHoldings(portfolio, result.tickers, result.lastPrices).map(e => {
    const signalRow = e.resolvedSymbol ? result.signalData.find(d => d.ticker === e.resolvedSymbol) : null;
    const value = e.price ? e.quantity * e.price : null;
    return { ...e, value, signal: signalRow?.signal ?? null, sector: signalRow?.sector ?? "Other" };
  });
  const priced = resolved.filter(e => e.value !== null);
  const pricedValue = priced.reduce((s, e) => s + e.value, 0);
  const hasPriceData = pricedValue > 0;

  let projection = null;
  if (hasPriceData) {
    const holdSymbols = priced.map(e => e.resolvedSymbol || e.symbol);
    projection = buildEqualWeightProjection(result.returns, result.tickers, holdSymbols, pricedValue);
  }

  return {
    holdings: resolved,
    count: portfolio.length,
    pricedCount: priced.length,
    pricedValue,
    hasPriceData,
    projection,
  };
}

function getOptimalHoldings() {
  const result = requirePipeline();
  const portfolio = getCurrentPortfolio();
  const holdings = buildOptimalHoldings({
    signalData: result.signalData, tickers: result.tickers, lastPrices: result.lastPrices,
    returns: result.returns, userPortfolio: portfolio, sectorNames: result.sectorNames,
  });
  let projection = null;
  if (holdings.hasPriceData && holdings.optimalHoldings.length) {
    const wArr = result.tickers.map(t => {
      const h = holdings.optimalHoldings.find(x => x.ticker === t);
      return h ? h.weight : 0;
    });
    projection = build5YearProjection(result.returns, wArr, holdings.pricedValue);
  }
  return { ...holdings, projection };
}

function getCashAllocation({ cash, topN = 10, riskMode = "balanced" }) {
  const result = requirePipeline();
  const allocation = buildCashAllocation({
    signalData: result.signalData, tickers: result.tickers, returns: result.returns,
    lastPrices: result.lastPrices, cash, topN, riskMode,
  });
  let projection = null;
  if (allocation && allocation.rows.length) {
    const wArr = result.tickers.map(t => {
      const row = allocation.rows.find(r => r.ticker === t);
      return row ? row.allocWeight : 0;
    });
    projection = build5YearProjection(result.returns, wArr, allocation.cash, "Cash", 400, 33);
  }
  return { ...allocation, projection };
}

// Resolves any portfolio tickers missing from the scraped price CSV via
// the merolagani fallback (server-side now — no browser CORS issue, and
// cached for CACHE_TTL_MS so repeated Bridge Trades requests don't
// refetch every ticker every time).
async function resolveMissingPrices(userPortfolio, tickers, lastPrices) {
  const resolved = resolvePortfolioHoldings(userPortfolio, tickers, lastPrices);
  const missing = resolved.filter(e => e.price === null);
  const fallbackPrices = {};
  await Promise.all(missing.map(async e => {
    try {
      const profile = await fetchMerolaganiProfileCached(e.resolvedSymbol || e.symbol);
      if (profile?.price) fallbackPrices[e.symbol] = profile.price;
    } catch {
      // leave unresolved — buildBridgeTrades reports it via missingFromPrices
    }
  }));
  return fallbackPrices;
}

async function getBridgeTrades() {
  const result = requirePipeline();
  const portfolio = getCurrentPortfolio();
  const fallbackPrices = await resolveMissingPrices(portfolio, result.tickers, result.lastPrices);
  return buildBridgeTrades({
    signalData: result.signalData, tickers: result.tickers, lastPrices: result.lastPrices,
    userPortfolio: portfolio, fallbackPrices,
  });
}

export {
  getCurrentPortfolio, setPortfolioFromCSV, getHoldings,
  getOptimalHoldings, getCashAllocation, getBridgeTrades,
};
