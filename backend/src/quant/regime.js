// Market-regime detection: rolling topological-homology regime classifier
// (persistent homology β1 on the correlation graph), the position-size
// regime scaler, and the classical-MDS + density-field geometry used to
// render the "regime terrain" visualization. Moved verbatim from
// src/App.jsx — only the MDS/density functions (previously computed in the
// browser on every render) are new to this module's *location*, not their
// logic.
import { corrMatEWMA } from "./correlation.js";
import { EWMA_LAMBDA } from "../config/constants.js";

// Periodic yield inside long rolling-window loops — harmless on the backend
// event loop too (lets other requests interleave during a long computation).
// Same helper `rollingRegime` relied on when this ran in the browser.
const sleep = ms => new Promise(r => setTimeout(r, ms));

function computeHomology(C) {
  // C is a flat Float64Array (row-major n×n) from corrMatEWMA
  const n = Math.round(Math.sqrt(C.length));
  const edges=[];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) {
    const d = Math.sqrt(Math.max(0, 2*(1 - C[i*n+j])));
    edges.push({i,j,d});
  }
  edges.sort((a,b)=>a.d-b.d);
  const par=Array.from({length:n},(_,i)=>i),rnk=new Array(n).fill(0);
  const find=x=>par[x]===x?x:(par[x]=find(par[x]));
  const unite=(a,b)=>{a=find(a);b=find(b);if(a===b)return false;
    if(rnk[a]<rnk[b]){let t=a;a=b;b=t;}par[b]=a;if(rnk[a]===rnk[b])rnk[a]++;return true;};
  let ei=0,comps=n,cyc=0;
  return Array.from({length:41},(_,k)=>{
    const eps=k/20;
    while(ei<edges.length&&edges[ei].d<=eps){if(unite(edges[ei].i,edges[ei].j))comps--;else cyc++;ei++;}
    return{eps:+eps.toFixed(2),β0:comps,β1:cyc};
  });
}


function topoFeatures(C) {
  const n = Math.round(Math.sqrt(C.length));
  const h=computeHomology(C);
  const intEps = h.find(p=>p.β0<=1)?.eps ?? 2.0;
  const cycBirth = h.find(p=>p.β1>0)?.eps ?? 2.0;
  const clust = h[20]?.β0 ?? 1;
  // avgCorr: mean pairwise correlation. Rises during crises (stocks fall together).
  // Much more discriminative than intEps/cycBirth on large universes (200+ tickers).
  let s = 0, cnt = 0;
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) { s += C[i*n+j]; cnt++; }
  const avgCorr = cnt > 0 ? s / cnt : 0;
  return { intEps, cycBirth, clust, avgCorr };
}

// ADAPTIVE: rolling percentile regime classification — hybrid 4-feature classifier
// Features used:
//   1. intEps    — epsilon at which graph fully connects (lower = more correlated = crisis)
//   2. cycBirth  — epsilon at first cycle (lower = denser graph = crisis)
//   3. avgCorr   — mean pairwise correlation (higher = crisis; robust on large universes)
//   4. realisedVol — 20-day annualised vol of equal-weight market return (higher = stress/crisis)
//
// Crisis/stress detection uses a SCORING approach (0-4 points) rather than AND/OR logic,
// so partial signals still register and no single feature dominates.

async function rollingRegime(rets, win=180, step=20) {
  const nD = rets[0].length;
  // Pre-compute equal-weight market returns for vol feature
  const mRets = Array.from({length: nD}, (_, t) => rets.reduce((s,r) => s+r[t], 0) / rets.length);

  const features = [];
  for (let t = win; t < nD; t += step) {
    const C = corrMatEWMA(rets, t-win, t, EWMA_LAMBDA);
    const topo = topoFeatures(C); // topoFeatures now accepts flat Float64Array
    // Realised vol over the last 20 days (annualised)
    const volSlice = mRets.slice(Math.max(0, t-20), t);
    const volMu = volSlice.reduce((a,b)=>a+b,0)/(volSlice.length||1);
    const realisedVol = Math.sqrt(volSlice.reduce((a,x)=>a+(x-volMu)**2,0)/(volSlice.length||1))*Math.sqrt(252);
    features.push({ day: t, ...topo, realisedVol });
    if (features.length % 5 === 0) await sleep(0);
  }

  // Score each step against its own rolling 60-step historical percentiles
  const raw = features.map((f, k) => {
    const lb = features.slice(Math.max(0, k - 60), k + 1);
    if (lb.length < 10) return { ...f, regime: "calm" };

    const pct = (arr, val) => {
      const sorted = [...arr].sort((a,b)=>a-b);
      const rank = sorted.filter(x => x <= val).length;
      return rank / sorted.length;
    };

    // For crisis features: low intEps/cycBirth = bad, high avgCorr/vol = bad
    const epsP    = pct(lb.map(x=>x.intEps),    f.intEps);       // low = crisis
    const cycP    = pct(lb.map(x=>x.cycBirth),   f.cycBirth);     // low = crisis
    const corrP   = pct(lb.map(x=>x.avgCorr),    f.avgCorr);      // high = crisis
    const volP    = pct(lb.map(x=>x.realisedVol),f.realisedVol);  // high = crisis

    // Weighted vote scoring — avgCorr and vol carry double weight (more reliable on large universes)
    // Each feature scores 0-2; total out of 8. Crisis ≥4, Stress ≥3.
    const crisisScore =
      (epsP  < 0.15 ? 1 : 0) +
      (cycP  < 0.15 ? 1 : 0) +
      (corrP > 0.85 ? 2 : corrP > 0.75 ? 1 : 0) +  // double-weighted
      (volP  > 0.85 ? 2 : volP  > 0.75 ? 1 : 0);   // double-weighted
    const stressScore =
      (epsP  < 0.30 ? 1 : 0) +
      (cycP  < 0.30 ? 1 : 0) +
      (corrP > 0.70 ? 2 : corrP > 0.60 ? 1 : 0) +
      (volP  > 0.70 ? 2 : volP  > 0.60 ? 1 : 0);

    // Fragmented: intEps unusually HIGH (disconnected graph) AND avgCorr is LOW (not a hidden crisis)
    // Requiring low avgCorr prevents fragmented from firing during volatile/crisis periods.
    const isFragmented = epsP > 0.90 && corrP < 0.40;

    if (crisisScore >= 4) return { ...f, regime: "crisis" };
    if (stressScore >= 3) return { ...f, regime: "stress" };
    if (isFragmented)     return { ...f, regime: "fragmented" };
    return { ...f, regime: "calm" };
  });

  // Confirmation: crisis needs 2 steps, stress/others need 1
  const series = [];
  let confirmed = "calm";
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k].regime;
    const next = k + 1 < raw.length ? raw[k+1].regime : cur;
    if (cur !== confirmed) {
      if (cur === "crisis" && cur !== next) { /* single-step crisis spike — ignore */ }
      else confirmed = cur;
    }
    series.push({ ...raw[k], regime: confirmed });
  }
  return series;
}

function buildRegimeMap(regimeSeries, nD) {
  const map = new Array(nD).fill("calm");
  for (let k = 0; k < regimeSeries.length; k++) {
    const dayA = regimeSeries[k].day;
    const dayB = k+1 < regimeSeries.length ? regimeSeries[k+1].day : nD;
    for (let d = dayA; d < dayB; d++) map[d] = regimeSeries[k].regime;
  }
  return map;
}


function regimeScale(regime, realisedVol = null, targetVol = 0.18, crisisScale = 0.3, stressScale = 0.9) {
  const base = (realisedVol != null && realisedVol > 0) ? Math.min(1.2, targetVol / realisedVol) : 1.2;
  if (regime === "crisis") return base * crisisScale;
  if (regime === "stress") return base * stressScale;
  if (regime === "fragmented") return base * 1.30;
  return base;
}


function powerIterEig(B, n, iters = 50) {
  let v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = 1 + i * 1e-3; // deterministic, non-degenerate seed
  let norm0 = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1e-9;
  for (let i = 0; i < n; i++) v[i] /= norm0;
  for (let it = 0; it < iters; it++) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0; const off = i * n; for (let j = 0; j < n; j++) s += B[off + j] * v[j]; w[i] = s; }
    const norm = Math.sqrt(w.reduce((a, x) => a + x * x, 0)) || 1e-9;
    for (let i = 0; i < n; i++) v[i] = w[i] / norm;
  }
  const Bv = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const off = i * n; for (let j = 0; j < n; j++) s += B[off + j] * v[j]; Bv[i] = s; }
  const lambda = v.reduce((a, x, i) => a + x * Bv[i], 0);
  return { vec: v, val: lambda };
}

function classicalMDS2D(corrFlat, n) {
  if (!n || n < 2) return Array.from({ length: n || 0 }, () => ({ x: 0.5, y: 0.5 }));
  // Same distance metric as computeHomology: d = sqrt(2(1-ρ))
  const D2 = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) { D2[i * n + j] = 0; continue; }
    const d = Math.sqrt(Math.max(0, 2 * (1 - corrFlat[i * n + j])));
    D2[i * n + j] = d * d;
  }
  const rowMean = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const off = i * n; for (let j = 0; j < n; j++) s += D2[off + j]; rowMean[i] = s / n; }
  let grand = 0; for (let i = 0; i < n; i++) grand += rowMean[i]; grand /= n;
  const B = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i * n + j] = -0.5 * (D2[i * n + j] - rowMean[i] - rowMean[j] + grand);
  const { vec: v1, val: l1 } = powerIterEig(B, n);
  const B2 = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B2[i * n + j] = B[i * n + j] - l1 * v1[i] * v1[j];
  const { vec: v2, val: l2 } = powerIterEig(B2, n);
  const s1 = Math.sqrt(Math.max(0, l1)), s2 = Math.sqrt(Math.max(0, l2));
  const raw = Array.from({ length: n }, (_, i) => ({ x: v1[i] * s1, y: v2[i] * s2 }));
  const xs = raw.map(p => p.x), ys = raw.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xR = (xMax - xMin) || 1, yR = (yMax - yMin) || 1;
  return raw.map(p => ({ x: (p.x - xMin) / xR, y: (p.y - yMin) / yR }));
}
// Gaussian-kernel density estimate of the point cloud over a coarse grid —
// rendered as discrete elevation bands (not a blurred gradient) for a terrain-map read.

function densityField(points, cols, rows, bandwidth = 0.11) {
  const grid = new Float64Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    const cy = (gy + 0.5) / rows;
    for (let gx = 0; gx < cols; gx++) {
      const cx = (gx + 0.5) / cols;
      let s = 0;
      for (let p = 0; p < points.length; p++) {
        const dx = points[p].x - cx, dy = points[p].y - cy;
        s += Math.exp(-(dx * dx + dy * dy) / (2 * bandwidth * bandwidth));
      }
      grid[gy * cols + gx] = s;
    }
  }
  let max = 0; for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
  return { grid, max: max || 1 };
}

// The signature element. #F5F0E6 is used here — and only here — per the design system.

export {
  computeHomology, topoFeatures, rollingRegime, buildRegimeMap, regimeScale,
  powerIterEig, classicalMDS2D, densityField,
};
