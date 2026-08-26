// Per-ticker signal construction: ensemble (topology-diffusion) signal,
// momentum/mean-reversion/short-term-reversion snapshots, and the
// quality/liquidity/low-cap eligibility filters. Moved verbatim from
// src/App.jsx.
import { corrMatEWMA, corrMatFromFlat, buildL, diffuse } from "./correlation.js";
import { EWMA_LAMBDA } from "../config/constants.js";

function ensembleSignal(rets, te, dA, dS, corrCache = null) {
  const windows = [{win: 10, w: 0.45}, {win: 30, w: 0.35}, {win: 90, w: 0.20}];
  const nS = rets.length;
  const combined = new Array(nS).fill(0);
  for (const {win, w} of windows) {
    const ts = Math.max(0, te - win);
    // Cache key: "ts:te" — reuse matrix if already computed for this window
    const cacheKey = `${ts}:${te}`;
    let C;
    if (corrCache && corrCache[cacheKey]) {
      C = corrCache[cacheKey];
    } else {
      C = corrMatEWMA(rets, ts, te, EWMA_LAMBDA);
      if (corrCache) corrCache[cacheKey] = C;
    }
    const L = buildL(corrMatFromFlat(C, nS));
    const decay = EWMA_LAMBDA;
    const slice = rets.map(r => r.slice(ts, te));
    const T = slice[0].length;
    const wts = Array.from({length: T}, (_, t) => Math.pow(decay, T-1-t));
    const wsum = wts.reduce((a,b)=>a+b, 0);
    const rec = slice.map(row => row.reduce((a,x,t) => a + wts[t]*x, 0) / wsum);
    const dif = diffuse(rec, L, dA, dS);
    const sig = rec.map((r,i) => r - dif[i]);
    const mu = sig.reduce((a,b)=>a+b,0)/nS;
    const sd = Math.sqrt(sig.reduce((a,b)=>a+(b-mu)**2,0)/nS) || 1e-9;
    sig.forEach((s,i) => { combined[i] += ((s-mu)/sd) * w; });
  }
  return combined;
}

// Helper: convert flat Float64Array back to nested array format needed by buildL
// (buildL accepts a 2D array for backward compat with callers that pass corr directly)

function meanReversionSignal(rets, te, lookback=20) {
  const scores = rets.map(r => -r.slice(Math.max(0, te-lookback), te).reduce((a,b)=>a+b,0));
  const mu = scores.reduce((a,b)=>a+b,0)/scores.length;
  const sd = Math.sqrt(scores.reduce((a,b)=>a+(b-mu)**2,0)/scores.length)||1e-9;
  return scores.map(s=>(s-mu)/sd);
}


function momentumSignal(rets, te, lookback=60) {
  const scores = rets.map(r => r.slice(Math.max(0, te-lookback), te).reduce((a,b)=>a+b,0));
  const mu = scores.reduce((a,b)=>a+b,0)/scores.length;
  const sd = Math.sqrt(scores.reduce((a,b)=>a+(b-mu)**2,0)/scores.length)||1e-9;
  return scores.map(s=>(s-mu)/sd);
}


function reversionSignal(rets, te, lookback=5) {
  const scores = rets.map(r => {
    const slice = r.slice(Math.max(0, te-lookback), te);
    const mu = slice.reduce((a,b)=>a+b, 0) / slice.length;
    const vol = Math.sqrt(slice.reduce((a,b)=>a+(b-mu)**2, 0) / slice.length) || 1e-9;
    return -slice.reduce((a,b)=>a+b, 0) / vol;
  });
  const mu = scores.reduce((a,b)=>a+b,0)/scores.length;
  const sd = Math.sqrt(scores.reduce((a,b)=>a+(b-mu)**2,0)/scores.length)||1e-9;
  return scores.map(s=>(s-mu)/sd);
}

// SOFTENED: gradient quality filter instead of binary

function qualityFilter(rets, te, lookback=40) {
  return rets.map(r => {
    const slice = r.slice(Math.max(0, te-lookback), te);
    if (slice.length < 5) return 1;
    const mu = slice.reduce((a,b)=>a+b,0)/slice.length;
    const sd = Math.sqrt(slice.reduce((a,b)=>a+(b-mu)**2,0)/slice.length) || 1e-9;
    const skew = slice.reduce((a,b)=>a+((b-mu)/sd)**3, 0) / slice.length;
    let q = 1.0;
    if (sd > 0.05) q *= 0.7;
    if (sd > 0.08) q *= 0.5;
    if (skew < -1.5) q *= 0.6;
    if (skew < -2.5) q *= 0.4;
    return q;
  });
}

// Liquidity filter: penalise bottom 20% of tickers by recent trading activity.
// Uses the fraction of non-zero return days as a proxy for turnover.
// Returns a multiplier in [0.2, 1.0] per ticker.

function liquidityFilter(rets, te, lookback=60) {
  const activity = rets.map(r => {
    const slice = r.slice(Math.max(0, te - lookback), te);
    if (slice.length < 5) return 1;
    return slice.filter(x => Math.abs(x) > 1e-7).length / slice.length;
  });
  const sorted = [...activity].sort((a,b) => a-b);
  const p20 = sorted[Math.floor(sorted.length * 0.20)] ?? 0;
  const p80 = sorted[Math.floor(sorted.length * 0.80)] ?? 1;
  const range = p80 - p20 || 1e-9;
  return activity.map(a => {
    const norm = Math.max(0, Math.min(1, (a - p20) / range));
    return 0.2 + 0.8 * norm; // floor at 0.2 so illiquid stocks shrink but aren't zeroed
  });
}

// Low-cap focus filter: on NEPSE, share price is a reasonable proxy for relative market cap
// (par value is standardised at Rs. 100; higher price → larger paid-up / market cap).
// Tickers with price in the bottom 50% by last price get a 1.0 multiplier (full weight),
// the top quartile gets 0.4, and the second quartile scales linearly in between.
// Pass lastPrices array aligned with rets; if unavailable returns all-ones.

function lowCapFilter(lastPrices) {
  if (!lastPrices || lastPrices.length === 0) return [];
  const n = lastPrices.length;
  const valid = lastPrices.filter(p => p && p > 0);
  if (valid.length === 0) return new Array(n).fill(1);
  const sorted = [...valid].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? 1;
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? p50;
  const range = p75 - p50 || 1e-9;
  return lastPrices.map(p => {
    if (!p || p <= 0) return 1;
    if (p <= p50) return 1.0;                                  // low-cap: full weight
    if (p >= p75) return 0.4;                                  // large-cap: 40% weight
    return 1.0 - 0.6 * ((p - p50) / range);                   // linear taper
  });
}


function stockVols(rets, s, e) {
  return rets.map(r => {
    const sl = r.slice(s, e);
    const mu = sl.reduce((a,b)=>a+b,0)/(sl.length||1);
    return Math.sqrt(sl.reduce((a,b)=>a+(b-mu)**2,0)/(sl.length||1))||1e-9;
  });
}


function estimateBetas(rets, marketRets, s, e) {
  return rets.map(r => {
    const slice = r.slice(s, e);
    const mSlice = marketRets.slice(s, e);
    const muR = slice.reduce((a,b) => a+b, 0) / (slice.length || 1);
    const muM = mSlice.reduce((a,b) => a+b, 0) / (mSlice.length || 1);
    const cov = slice.reduce((a,x,t) => a + (x-muR)*(mSlice[t]-muM), 0) / (slice.length || 1);
    const varM = mSlice.reduce((a,x) => a + (x-muM)**2, 0) / (mSlice.length || 1) || 1e-9;
    return cov / varM;
  });
}

// REVERTED: top-half + linear rank weighting (more stable on NEPSE)

export {
  ensembleSignal, meanReversionSignal, momentumSignal, reversionSignal,
  qualityFilter, liquidityFilter, lowCapFilter, stockVols, estimateBetas,
};
