// Centralised tuning constants for the quant engine.
// Moved from src/App.jsx (frontend) — values unchanged, do not edit casually.
// These were previously scattered as inline magic numbers. Change them here only.
const EWMA_LAMBDA = 0.94;  // EWMA decay factor for correlation estimation
const REV_BLEND   = 0.20;  // weight of short-term reversion signal in the ensemble blend
const CGT_SHORT_TERM_RATE = 0.075, CGT_LONG_TERM_RATE = 0.05;


// Default backtest/signal parameters (also the shape of the `params` object
// accepted by POST /api/backtests).
const DEFAULT_PARAMS = {diffAlpha:0.15,diffSteps:8,win:180,emb:20,txCost:0.0045,momBlend:0.20,crisisScale:0.30,stressScale:0.90,ddFloor:0.19,stopLoss:0.10,maxPos:0.19,targetVol:0.18};

// Default sector names used by the synthetic data generator and as the
// fallback sector list when no sectors CSV is available. Moved from
// src/App.jsx (FALLBACK_SEC_NAMES) — the frontend keeps its own copy for
// sector-color palette indexing (a presentation concern), this is the data
// value the fallback path actually generates.
const FALLBACK_SEC_NAMES = ["Commercial Bank", "Finance", "Hydropower", "Non-Life Insurance", "Other"];

export { EWMA_LAMBDA, REV_BLEND, CGT_SHORT_TERM_RATE, CGT_LONG_TERM_RATE, DEFAULT_PARAMS, FALLBACK_SEC_NAMES };
