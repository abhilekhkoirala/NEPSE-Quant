// Scores an IPO/FPO listing (0-100) by blending sector-peer signal
// strength, current market regime, subscription-window timing, and issue
// type. Moved verbatim from src/App.jsx.

function scoreIPO(ipo, result) {
  // 1. Sector alignment (0–40): average signal of same-sector listed stocks
  let sectorScore = 20; // neutral default
  if (result?.signalData) {
    const sector = ipo.sector || ipo.sector_name || ipo.category || "";
    const peers = result.signalData.filter(d => d.sector === sector);
    if (peers.length > 0) {
      const avg = peers.reduce((s,d) => s + d.signal, 0) / peers.length;
      sectorScore = Math.round(Math.max(0, Math.min(40, (avg + 1) * 20)));
    }
  }

  // 2. Market regime (0–30)
  const regimeScores = { calm: 30, fragmented: 22, stress: 12, crisis: 4 };
  const regScore = regimeScores[result?.lastRegime || "calm"] ?? 20;

  // 3. Status / timing (0–20)
  const statusScores = { open: 20, allotment: 8, upcoming: 14, closed: 0, "Approved": 14 };
  const statScore = statusScores[ipo.status] ?? 10;

  // 4. Type (0–10): IPO=10, FPO=8, Rights=5, Debenture=6, MF=4
  const typeScores = { IPO: 10, Ordinary: 10, FPO: 8, Rights: 5, Debenture: 6, "Mutual Fund": 4 };
  const typeScore = typeScores[ipo.type] ?? 5;

  const total = sectorScore + regScore + statScore + typeScore;
  return { total, sectorScore, regScore, statScore, typeScore, max: 100 };
}


export { scoreIPO };
