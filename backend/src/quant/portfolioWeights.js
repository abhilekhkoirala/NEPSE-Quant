// Converts a filtered signal vector into sector/vol/beta-adjusted portfolio
// weights (long-only, capped position size). Moved verbatim from
// src/App.jsx.
function buildWeights(sig, sectors, volScales, nSectors, betas = null, regime="calm", maxPos = 0.22) {
  const nS = sig.length;
  const rawW = new Array(nS).fill(0);
  const volFloor = 0.005;
  for (let sec = 0; sec < nSectors; sec++) {
    const idx = sig.map((_,i) => i).filter(i => sectors[i] === sec);
    if (idx.length < 2) continue;
    const ranked = idx.map(i => ({i, s: sig[i]})).sort((a,b) => b.s - a.s);
    const topHalf = ranked.slice(0, Math.ceil(ranked.length / 2));
    const nTop = topHalf.length;
    const denom = (nTop * (nTop + 1)) / 2;
    topHalf.forEach(({i}, rank) => {
      const rankW = (nTop - rank) / denom;
      const isRisky = (regime === "stress" || regime === "crisis");
      const betaAdj = (betas && isRisky) ? Math.max(0.6, betas[i] > 1.2 ? betas[i] * 1.5 : betas[i]) : 1;
      rawW[i] = rankW / (Math.max(volFloor, volScales[i] || 0) * betaAdj);
    });
  }
  const gross1 = rawW.reduce((a,b) => a + Math.abs(b), 0) || 1;
  let w = rawW.map(x => x / gross1);
  for (let iter = 0; iter < 12; iter++) {
    let excess = 0, pool = 0;
    for (let i = 0; i < nS; i++) {
      if (w[i] > maxPos) { excess += w[i] - maxPos; w[i] = maxPos; }
      else if (w[i] > 0 && w[i] < maxPos) { pool += w[i]; }
    }
    if (excess <= 1e-7 || pool <= 1e-7) break;
    const factor = (pool + excess) / pool;
    for (let i = 0; i < nS; i++) if (w[i] > 0 && w[i] < maxPos) w[i] = Math.min(maxPos, w[i] * factor);
  }
  // Sector cap at 44% 
  const SECTOR_CAP = 0.44;
  for (let sec = 0; sec < nSectors; sec++) {
    const secIdx = w.map((_,i) => i).filter(i => sectors[i] === sec);
    const secSum = secIdx.reduce((a,i) => a + w[i], 0);
    if (secSum > SECTOR_CAP) {
      const scale = SECTOR_CAP / secSum;
      secIdx.forEach(i => { w[i] *= scale; });
    }
  }
  const grossFinal = w.reduce((a,b) => a + Math.abs(b), 0) || 1;
  w = w.map(x => x / grossFinal);
  return w;
}

// Build a sparse Laplacian representation: store only non-zero edges + degree vector.
// This reduces the diffuse() inner loop from O(n²) to O(|edges|) per step,
// which is significantly faster when average correlation is low (sparse graph).

export { buildWeights };
