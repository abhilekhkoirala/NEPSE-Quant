// Derived portfolio/trading calculations that used to run inside React
// components (OptimalHoldings, CashAllocator, LiveMirror all had their own
// near-identical copies of "resolve portfolio symbol -> price" plus their
// own scoring/allocation math operating on the raw per-ticker return
// series). Moved here as plain functions, taking the pipeline's cached
// data as explicit parameters instead of reading React state.
//
// The three original components each defined their own SYMBOL_ALIAS +
// normalizeSymbol + "resolved" price-lookup block, byte-for-byte identical
// logic. That duplication is consolidated into resolvePortfolioHoldings()
// below — same alias map, same lookup order, called from three services
// instead of copy-pasted three times.
import { calcNEPSECost } from "./costs.js";

// Known portfolio-CSV ticker aliases -> canonical ticker used in the price
// data. (Originally duplicated in OptimalHoldings, LiveMirror, PortfolioTab.)
const SYMBOL_ALIAS = { "PMLI": "PMLI", "SRLI": "SRLI", "UAIL": "UAIL", "SKHEL": "SKBBL" };
function normalizeSymbol(s) { return SYMBOL_ALIAS[s] || s; }

// Detect closed/halted stocks: last `staleWindow` returns all ~zero means
// the price hasn't moved. Identical logic previously duplicated in
// OptimalHoldings and CashAllocator.
function isActiveStock(ticker, tickers, returns, staleWindow = 30) {
  const idx = tickers.indexOf(ticker);
  if (idx === -1 || !returns?.[idx]) return true;
  const recent = returns[idx].slice(-staleWindow);
  if (recent.length < 5) return true;
  return recent.some(r => Math.abs(r) > 1e-7);
}

// Resolve each {symbol, quantity} portfolio entry to a ticker + price,
// preferring the scraped price CSV and falling back to a supplied
// fallbackPrices map (symbol -> price, e.g. from merolagani).
function resolvePortfolioHoldings(userPortfolio, tickers, lastPrices, fallbackPrices = {}) {
  const tickerIndex = new Map(tickers.map((t, i) => [t, i]));
  return userPortfolio.map(entry => {
    const aliased = normalizeSymbol(entry.symbol);
    const idx = tickerIndex.has(aliased) ? tickerIndex.get(aliased)
               : tickerIndex.has(entry.symbol) ? tickerIndex.get(entry.symbol) : -1;
    const csvPrice = (idx !== -1 && lastPrices) ? lastPrices[idx] : null;
    const fbPrice = fallbackPrices[entry.symbol] ?? fallbackPrices[aliased] ?? null;
    const price = csvPrice ?? fbPrice;
    const priceSource = csvPrice != null ? "csv" : fbPrice != null ? "merolagani" : null;
    return { ...entry, resolvedSymbol: idx !== -1 ? tickers[idx] : null, price, priceSource, idx };
  });
}

// ─── Optimal Holdings ─────────────────────────────────────────────────────
// Target allocation: current signal weights applied to the user's priced
// portfolio value, floored to whole share units. Moved from the
// OptimalHoldings component (2025 refactor) — same formulas.
function buildOptimalHoldings({ signalData, tickers, lastPrices, returns, userPortfolio, sectorNames }) {
  const resolved = resolvePortfolioHoldings(userPortfolio, tickers, lastPrices);
  const pricedValue = resolved.reduce((acc, e) => acc + (e.price ? e.quantity * e.price : 0), 0);
  const hasPriceData = pricedValue > 0;

  const STALE_WINDOW = 30;
  const allPositive = signalData.filter(d => d.weight > 0);
  const closedFiltered = allPositive.filter(d => !isActiveStock(d.ticker, tickers, returns, STALE_WINDOW));
  const optimalHoldings = allPositive
    .filter(d => isActiveStock(d.ticker, tickers, returns, STALE_WINDOW))
    .map(d => {
      const idx = tickers.indexOf(d.ticker);
      const price = (idx !== -1 && lastPrices) ? lastPrices[idx] : null;
      const targetValue = d.weight * pricedValue;
      const units = (price && hasPriceData) ? Math.floor(targetValue / price) : null;
      return { ticker: d.ticker, sector: d.sector, weight: d.weight, signal: d.signal, price, targetValue, units };
    })
    .sort((a, b) => b.weight - a.weight);

  const totalWeight = optimalHoldings.reduce((s, h) => s + h.weight, 0);
  const totalValue = optimalHoldings.reduce((s, h) => s + h.targetValue, 0);

  const sectorMap = {};
  optimalHoldings.forEach(h => {
    if (!sectorMap[h.sector]) sectorMap[h.sector] = 0;
    sectorMap[h.sector] += h.weight;
  });
  const sectorData = Object.entries(sectorMap)
    .map(([sector, weight]) => ({ sector, weight: +(weight * 100).toFixed(2) }))
    .sort((a, b) => b.weight - a.weight);

  return {
    pricedValue, hasPriceData, optimalHoldings, closedStocks: closedFiltered.map(d => d.ticker),
    totalWeight, totalValue, sectorData, sectorNames: sectorNames || null,
  };
}

// ─── Cash Allocator ───────────────────────────────────────────────────────
// Deploys a fresh cash amount across the top-N eligible signals, blending
// signal strength with 60-day momentum and capping concentration by risk
// mode. Moved from the CashAllocator component — same formulas.
const RISK_BOOST = { aggressive: 1.35, balanced: 1.0, conservative: 0.65 };
const RISK_CONCENTRATION = { aggressive: 0.30, balanced: 0.22, conservative: 0.15 };

function getMomentum(ticker, tickers, returns) {
  const idx = tickers.indexOf(ticker);
  if (idx === -1) return 0;
  const slice = returns[idx].slice(-60);
  return slice.reduce((a, b) => a + b, 0) * (252 / 60);
}

function buildCashAllocation({ signalData, tickers, returns, lastPrices, cash, topN = 10, riskMode = "balanced" }) {
  if (!cash || cash <= 0) return null;
  const STALE_WINDOW = 30;
  const boost = RISK_BOOST[riskMode] ?? RISK_BOOST.balanced;
  const maxPos = RISK_CONCENTRATION[riskMode] ?? RISK_CONCENTRATION.balanced;

  const candidates = signalData
    .filter(d => d.weight > 0 && isActiveStock(d.ticker, tickers, returns, STALE_WINDOW))
    .map(d => {
      const mom = getMomentum(d.ticker, tickers, returns);
      const score = d.signal * boost + mom * 0.4;
      const idx = tickers.indexOf(d.ticker);
      const price = (idx !== -1 && lastPrices) ? lastPrices[idx] : null;
      return { ...d, score, momentum: mom, price };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (candidates.length === 0) return { rows: [], cash, deployed: 0, leftover: cash };

  const rawScores = candidates.map(c => Math.max(0, c.score));
  const scoreSum = rawScores.reduce((a, b) => a + b, 0) || 1;
  let w = rawScores.map(s => s / scoreSum);

  for (let iter = 0; iter < 15; iter++) {
    let excess = 0, pool = 0;
    for (let i = 0; i < w.length; i++) {
      if (w[i] > maxPos) { excess += w[i] - maxPos; w[i] = maxPos; }
      else if (w[i] > 0) pool += w[i];
    }
    if (excess <= 1e-7 || pool <= 1e-7) break;
    const factor = (pool + excess) / pool;
    for (let i = 0; i < w.length; i++) if (w[i] > 0 && w[i] < maxPos) w[i] = Math.min(maxPos, w[i] * factor);
  }

  const wSum = w.reduce((a, b) => a + b, 0) || 1;
  w = w.map(x => x / wSum);

  let rows = candidates.map((c, i) => {
    const alloc = w[i] * cash;
    const units = c.price ? Math.floor(alloc / c.price) : null;
    const actualAlloc = (units !== null && c.price) ? units * c.price : alloc;
    return { ...c, allocWeight: w[i], alloc, units, actualAlloc };
  });

  let remaining = cash - rows.reduce((s, r) => s + (r.actualAlloc ?? r.alloc), 0);
  if (remaining > 0) {
    const eligible = rows
      .map((r, i) => ({ i, remainder: r.price ? (r.alloc - r.actualAlloc) : 0, price: r.price }))
      .filter(e => e.price && e.price <= remaining)
      .sort((a, b) => b.remainder - a.remainder);
    for (const e of eligible) {
      if (remaining < e.price) continue;
      rows[e.i] = { ...rows[e.i], units: rows[e.i].units + 1, actualAlloc: rows[e.i].actualAlloc + e.price };
      remaining -= e.price;
    }
  }

  const deployed = rows.reduce((s, r) => s + (r.actualAlloc ?? r.alloc), 0);
  return { rows, cash, deployed, leftover: cash - deployed };
}

// ─── Bridge Trades (Live Mirror) ──────────────────────────────────────────
// Diffs the user's uploaded portfolio against the model's target weights
// and proposes BUY/SELL/HOLD orders with estimated NEPSE transaction
// costs. Moved from the LiveMirror component — same formulas. The
// original also drove its own merolagani-price-fallback fetch loop
// in-browser for stocks missing from the CSV; that I/O now happens in the
// service layer (see services/portfolioService.js) which resolves
// fallbackPrices *before* calling this function, so this stays pure.
function buildBridgeTrades({ signalData, tickers, lastPrices, userPortfolio, fallbackPrices = {} }) {
  const resolved = resolvePortfolioHoldings(userPortfolio, tickers, lastPrices, fallbackPrices);
  const tickerIndex = new Map(tickers.map((t, i) => [t, i]));

  const missingFromPrices = resolved.filter(e => e.price === null);
  const priced = resolved.filter(e => e.price !== null);
  const pricedValue = priced.reduce((acc, e) => acc + e.quantity * e.price, 0);
  const hasPriceData = pricedValue > 0;
  const safeTotalValue = hasPriceData ? pricedValue : 1;

  const portfolioByTicker = {};
  priced.forEach(e => {
    if (e.resolvedSymbol) portfolioByTicker[e.resolvedSymbol] = e;
    portfolioByTicker[e.symbol] = e;
  });

  const signalTickers = new Set(signalData.map(d => d.ticker));

  const bridgeFromModel = signalData.map(d => {
    const userPos = portfolioByTicker[d.ticker];
    const idx = tickerIndex.get(d.ticker) ?? -1;
    const currentPrice = (idx !== -1 && lastPrices) ? lastPrices[idx] : null;
    const currentValue = userPos ? userPos.quantity * (currentPrice ?? 0) : 0;
    const currentWeight = hasPriceData ? currentValue / safeTotalValue : 0;
    const targetWeight = d.weight;
    const diff = targetWeight - currentWeight;
    const action = diff > 0.01 ? "BUY" : diff < -0.01 ? "SELL" : "HOLD";
    let units = null;
    if (currentPrice !== null) {
      const rawUnits = (diff * safeTotalValue) / currentPrice;
      units = action === "BUY" ? Math.floor(rawUnits) : Math.ceil(rawUnits);
    }
    return {
      ticker: d.ticker, currentWeight, targetWeight, action, units,
      missingPrice: currentPrice === null, inPortfolio: !!userPos, price: currentPrice,
    };
  }).filter(b => b.action !== "HOLD" || b.currentWeight > 0.001)
    .sort((a, b) => b.targetWeight - a.targetWeight);

  const orphanRows = priced
    .filter(e => !signalTickers.has(e.resolvedSymbol) && !signalTickers.has(e.symbol))
    .map(e => ({
      ticker: e.resolvedSymbol || e.symbol,
      currentWeight: e.quantity * e.price / safeTotalValue,
      targetWeight: 0, action: "SELL", units: e.quantity, missingPrice: false,
      priceSource: e.priceSource, inPortfolio: true, noSignal: true, price: e.price,
    }));

  const bridge = [...bridgeFromModel, ...orphanRows];

  const bridgeWithCosts = bridge.map(b => {
    const tradeUnits = b.units !== null ? Math.abs(b.units) : null;
    const turnover = (b.price && tradeUnits) ? b.price * tradeUnits : null;
    const costData = turnover ? calcNEPSECost(turnover, { isSell: b.action === "SELL" }) : null;
    return { ...b, costData };
  });

  const totalEstCost = bridgeWithCosts.reduce((sum, b) => sum + (b.costData ? b.costData.total : 0), 0);
  const currentCoveragePct = hasPriceData
    ? priced.reduce((s, e) => s + (e.quantity * e.price / safeTotalValue), 0) * 100
    : null;
  const targetCoveragePct = signalData.filter(d => d.weight > 0).reduce((s, d) => s + d.weight, 0) * 100;

  return {
    bridge: bridgeWithCosts, missingFromPrices: missingFromPrices.map(e => e.symbol),
    pricedValue, hasPriceData, totalEstCost, currentCoveragePct, targetCoveragePct,
    orphanCount: orphanRows.length,
  };
}

export {
  SYMBOL_ALIAS, normalizeSymbol, isActiveStock, resolvePortfolioHoldings,
  buildOptimalHoldings, buildCashAllocation, buildBridgeTrades,
  RISK_BOOST, RISK_CONCENTRATION,
};
