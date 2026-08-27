// Price/sector CSV parsing and the synthetic-data fallback generator used
// when no real data source (server scrape or static snapshot) is
// reachable. Moved verbatim from src/App.jsx.
import { mkRng } from "../quant/random.js";
import { FALLBACK_SEC_NAMES } from "../config/constants.js";

function generateData(nD = 750) {
  const rng = mkRng(42);
  const tickers = ["NICA","NMB","ADBL","GBIME","PRVU","JBBL","NIMB","CZBIL","NICLBSL","UPPER","SHPC","KPCL","SRLI","RNLI","NIFRA"];
  const sectors = [0,0,0,0,0,0,1,1,1,2,2,2,3,3,4];
  const mBeta = tickers.map(() => 0.5 + rng() * 0.9);
  const sBeta = tickers.map(() => 0.2 + rng() * 0.6);
  const alpha = tickers.map(() => (rng() - 0.5) * 0.00055);
  const mRet = Array.from({ length: nD }, (_, t) => {
    const crisis = t > 260 && t < 420, recovery = t > 420 && t < 520;
    const sigma = crisis ? 0.024 : recovery ? 0.016 : 0.013;
    const drift = crisis ? -0.0022 : recovery ? 0.0010 : 0.0003;
    return (rng() - 0.5) * sigma + drift;
  });
  const sRet = Array.from({ length: 5 }, () =>
    Array.from({ length: nD }, (_, t) => (rng() - 0.5) * (t > 260 && t < 420 ? 0.014 : 0.008)));
  const idio = tickers.map((_, i) => {
    const a = new Array(nD); a[0] = (rng() - 0.5) * 0.011;
    for (let t = 1; t < nD; t++) a[t] = 0.13 * a[t-1] + (rng()-0.5)*0.01 + alpha[i];
    return a;
  });
  const returns = tickers.map((_, i) =>
    Array.from({ length: nD }, (_, t) => mBeta[i]*mRet[t] + sBeta[i]*sRet[sectors[i]][t] + idio[i][t]));
  // Synthetic calendar so this fallback dataset carries the same `dates`
  // shape (nD+1 entries, one per "price row") that parseCSVData produces
  // from a real CSV — keeps downstream code (periods date-labeling) from
  // needing to special-case the no-dates case.
  const dayMs = 86400000;
  const base = Date.UTC(2020, 0, 1);
  const dates = Array.from({ length: nD + 1 }, (_, i) => new Date(base + i * dayMs).toISOString().slice(0, 10));
  return { tickers, sectors, sectorNames: FALLBACK_SEC_NAMES, returns, nD, dates };
}


function parseSectorCSV(csvText) {
  const lines = csvText.trim().split("\n").map(l => l.trim()).filter(Boolean);
  // Use a Set for O(1) membership checks while preserving insertion order
  const sectorSetObj = new Set();
  const tickerToSectorName = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 3) continue;
    const [symbol, , sector] = cols;
    if (!symbol || !sector) continue;
    tickerToSectorName[symbol] = sector;
    sectorSetObj.add(sector);
  }
  const sectorNames = [...sectorSetObj];
  // Build a Map for O(1) index lookups instead of repeated indexOf calls
  const sectorIdx = new Map(sectorNames.map((s, i) => [s, i]));
  const tickerToIdx = Object.fromEntries(
    Object.entries(tickerToSectorName).map(([sym, sec]) => [sym, sectorIdx.get(sec) ?? 0])
  );
  return { sectorNames, tickerToIdx };
}


function parseCSVData(csvText, sectorMeta = null) {
  const lines = csvText.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 10) throw new Error("CSV too short.");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const tickers = headers.slice(1);
  if (tickers.length === 0) throw new Error("No ticker columns found.");

  let sectorNames;
  let tickerToIdx;
  if (sectorMeta && sectorMeta.sectorNames.length > 0) {
    sectorNames = sectorMeta.sectorNames;
    tickerToIdx = sectorMeta.tickerToIdx;
  } else {
    sectorNames = [...FALLBACK_SEC_NAMES];
    const FALLBACK_MAP = {
      NICA:0, NMB:0, ADBL:0, GBIME:0, PRVU:0, JBBL:0, SANIMA:0, EBL:0, HBL:0, KBL:0, MBL:0, NBL:0, NABIL:0, PCBL:0, SBI:0, SBL:0, BOKL:0, CBL:0, NIB:0, SCB:0,
      NIMB:1, CZBIL:1, NICLBSL:1, GUFL:1, MFIL:1, GFCL:1,
      UPPER:2, SHPC:2, KPCL:2, BPCL:2, RIDI:2, API:2, HDHPC:2, RHPC:2, NHPC:2, NGPL:2, SSHL:2, AKPL:2,
      SRLI:3, RNLI:3, NLICL:3, LICN:3, ALICL:3,
    };
    tickerToIdx = {};
    for (const t of tickers) tickerToIdx[t] = FALLBACK_MAP[t] ?? (sectorNames.length - 1);
  }
  const sectors = tickers.map(t => tickerToIdx[t] ?? (sectorNames.length - 1));

  const prices = tickers.map(() => []);
  const dates = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    dates.push(cols[0]);
    for (let j = 0; j < tickers.length; j++) {
      const v = parseFloat(cols[j + 1]);
      prices[j].push(isNaN(v) || v <= 0 ? null : v);
    }
  }

  prices.forEach(col => {
    let last = col.find(v => v !== null) ?? 100;
    for (let i = 0; i < col.length; i++) {
      if (col[i] === null) col[i] = last;
      else last = col[i];
    }
  });

  const nD = prices[0].length - 1;
  const returns = prices.map(col =>
    Array.from({ length: nD }, (_, t) => {
      const ret = Math.log(col[t + 1] / col[t]);
      return isFinite(ret) ? ret : 0;
    })
  );

  // dates[i] is the calendar date of price row i (same indexing as the
  // `prices` columns above, length nD+1). returns[stock][t] = log(price[t+1]/price[t]),
  // i.e. the return at row-index t is realized on dates[t+1] — that's the
  // mapping periods/curve "day" indices use to get real dates back (see
  // backend/src/api/backtests.js withTaxBreakdown).
  return { tickers, sectors, sectorNames, returns, nD, lastPrices: prices.map(p => p[p.length-1]), dates };
}

// Returns a flat Float64Array of size n×n (row-major) for cache-efficient access.
// Use corrGet(C, n, i, j) to read values.

export { generateData, parseSectorCSV, parseCSVData };
