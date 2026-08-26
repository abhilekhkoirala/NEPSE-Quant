// Correlation-matrix utilities: EWMA correlation estimation, flat n×n
// indexing helpers, and the graph-Laplacian diffusion used by the ensemble
// signal / regime engine. Moved verbatim from src/App.jsx.
// (EWMA_LAMBDA itself lives in config/constants.js — callers pass it in.)

function corrGet(C, n, i, j) { return C[i * n + j]; }


function corrMatEWMA(rets, s, e, lambda=0.94) {
  const r = rets.map(row => row.slice(s, e));
  const T = r[0].length, n = r.length;
  // Circuit breaker: identify days where >15% of tickers hit the NEPSE ±10% daily limit
  // Those days produce artificially truncated correlations — down-weight by 0.3
  const cbWeight = Array.from({length: T}, (_, t) => {
    const hitFrac = r.filter(row => Math.abs(row[t]) >= 0.095).length / n;
    return hitFrac > 0.15 ? 0.3 : 1.0;
  });
  const w = Array.from({length:T}, (_, t) => Math.pow(lambda, T-1-t) * cbWeight[t]);
  const wsum = w.reduce((a,b)=>a+b,0);
  const wn = w.map(x=>x/wsum);
  const mu = r.map(row => row.reduce((a,x,t)=>a+wn[t]*x, 0));
  const vari = r.map((row,i) => Math.sqrt(row.reduce((a,x,t)=>a+wn[t]*(x-mu[i])**2,0))||1e-9);
  // Use flat Float64Array instead of nested arrays for 2–3× better cache performance
  const C = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { C[i*n+j] = 1; continue; }
      const cov = r[i].reduce((a,x,t)=>a+wn[t]*(x-mu[i])*(r[j][t]-mu[j]),0);
      C[i*n+j] = Math.max(-1, Math.min(1, cov/(vari[i]*vari[j])));
    }
  }
  return C;
}

// TUNED: longer, more stable windows for NEPSE daily data
// corrCache: optional {key → Float64Array} to reuse already-computed matrices across callers

function corrMatFromFlat(C, n) {
  return Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => C[i*n+j]));
}


function buildL(corr) {
  const n = corr.length;
  const edges = []; // {i, j, w} — off-diagonal positive weights only
  const degree = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const w = Math.max(0, corr[i][j]);
        if (w > 0) {
          edges.push(i, j, w); // packed flat for cache friendliness
          degree[i] += w;
        }
      }
    }
  }
  return { edges, degree, n };
}

// Sparse diffusion: L*v = degree[i]*v[i] - sum_j(W[i][j]*v[j])

function diffuse(x, L, alpha = 0.15, steps = 8) {
  const { edges, degree, n } = L;
  const v = new Float64Array(x);
  const Lv = new Float64Array(n);
  for (let s = 0; s < steps; s++) {
    Lv.fill(0);
    // Subtract off-diagonal weighted contributions
    for (let k = 0; k < edges.length; k += 3) {
      const i = edges[k], j = edges[k + 1], w = edges[k + 2];
      Lv[i] -= w * v[j];
    }
    // Add diagonal (degree) contribution
    for (let i = 0; i < n; i++) Lv[i] += degree[i] * v[i];
    // Update v
    for (let i = 0; i < n; i++) v[i] -= alpha * Lv[i];
  }
  return Array.from(v);
}


export { corrGet, corrMatEWMA, corrMatFromFlat, buildL, diffuse };
