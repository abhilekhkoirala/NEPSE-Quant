// Monte-Carlo 5-year portfolio value projections (geometric Brownian
// motion fit to trimmed historical daily returns) — used by the Optimal
// Holdings / Cash Allocator / Portfolio tabs. Moved verbatim from
// src/App.jsx.
import { mkRng } from "./random.js";

function build5YearProjection(returns, weights, initialValue, label = "Strategy", nSim = 400, seed = 99) {
  const rng = mkRng(seed);
  const nD = returns[0]?.length ?? 0;
  if (nD < 20) return [];

  // Compute historical daily portfolio log-returns (weighted sum)
  const histRets = Array.from({ length: nD }, (_, t) =>
    returns.reduce((s, r, i) => s + (weights[i] ?? 0) * (isFinite(r[t]) ? r[t] : 0), 0)
  );

  // Use trimmed mean/sd: ignore top+bottom 1% to avoid outlier distortion
  const sorted = [...histRets].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.01);
  const trimmed = sorted.slice(trim, sorted.length - trim);
  const mu = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  const variance = trimmed.reduce((a, b) => a + (b - mu) ** 2, 0) / trimmed.length;
  const sd = Math.sqrt(variance) || 0.008;

  // Ito correction: for log-normal GBM, drift in log-space = mu - 0.5*sigma^2
  // This ensures the median path (p50) matches the geometric mean correctly
  const drift = mu - 0.5 * variance;

  const years = 5, days = years * 252;

  // Box-Muller transform for proper standard normal samples
  const randn = () => {
    const u1 = Math.max(1e-10, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  // Run simulations using geometric Brownian Motion
  const sims = Array.from({ length: nSim }, () => {
    let logV = 0; // log of portfolio value (starts at 1x)
    return Array.from({ length: days }, () => {
      logV += drift + sd * randn();
      return Math.exp(logV); // portfolio value as multiple of initial
    });
  });

  // Build percentile bands at monthly intervals (~21 trading days)
  const step = 21;
  const points = [];
  for (let d = 0; d <= days; d += step) {
    if (d === 0) {
      points.push({ month: 0, label: "Now", p10: initialValue, p25: initialValue, p50: initialValue, p75: initialValue, p90: initialValue });
      continue;
    }
    const vals = sims.map(s => (s[d - 1] ?? s[s.length - 1]) * initialValue).sort((a, b) => a - b);
    const pct = (p) => vals[Math.min(Math.floor(vals.length * p), vals.length - 1)];
    points.push({
      month: Math.round(d / 21),
      label: d % (21 * 6) === 0 ? `Y${Math.round(d / 252)}` : "",
      p10: Math.round(pct(0.10)),
      p25: Math.round(pct(0.25)),
      p50: Math.round(pct(0.50)),
      p75: Math.round(pct(0.75)),
      p90: Math.round(pct(0.90)),
    });
  }
  return points;
}

// Build equal-weight (do-nothing) projection from current portfolio returns

function buildEqualWeightProjection(returns, tickers, portfolioSymbols, initialValue) {
  if (!portfolioSymbols || portfolioSymbols.length === 0) {
    // fallback: equal-weight all tickers
    const w = new Array(tickers.length).fill(1 / tickers.length);
    return build5YearProjection(returns, w, initialValue, "Hold", 400, 77);
  }
  const w = new Array(tickers.length).fill(0);
  let count = 0;
  portfolioSymbols.forEach(sym => {
    const idx = tickers.indexOf(sym);
    if (idx !== -1) { w[idx] = 1; count++; }
  });
  if (count > 0) w.forEach((_, i) => { if (w[i] > 0) w[i] = 1 / count; });
  return build5YearProjection(returns, w, initialValue, "Hold", 400, 77);
}


export { build5YearProjection, buildEqualWeightProjection };
