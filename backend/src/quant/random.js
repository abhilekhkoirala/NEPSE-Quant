// Deterministic seeded PRNG used throughout the quant engine (backtests,
// Monte Carlo projections, bootstrap resampling) so runs are reproducible.
// Moved verbatim from src/App.jsx.
function mkRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}


export { mkRng };
