// News-driven signal/regime adjustments: a per-ticker sentiment overlay
// applied to the blended signal, and a market-wide news-flow "regime
// filter" that scales position sizing on heavy negative flow. Moved
// verbatim from src/App.jsx.

function applyNewsSentimentOverlay(signals, tickers, newsItems, {
  newsBoost  = 0.12,   // max positive uplift  (+12%)
  newsDamp   = 0.25,   // max negative dampen  (-25%)
  staleDays  = 7,      // ignore items older than this many days
} = {}) {
  if (!newsItems || newsItems.length === 0) return signals;

  // Filter to recent items only
  const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString().slice(0,10);
  const recent = newsItems.filter(n => !n.date || n.date >= cutoff);
  if (recent.length === 0) return signals;

  // Build per-ticker sentiment score: +1 per positive item, -1 per negative
  const tickerScore = {};
  const tickerCount = {};
  for (const item of recent) {
    if (!item.tickers_mentioned?.length) continue;
    const delta = item.sentiment_hint === "positive" ? 1 : item.sentiment_hint === "negative" ? -1 : 0;
    for (const t of item.tickers_mentioned) {
      tickerScore[t] = (tickerScore[t] || 0) + delta;
      tickerCount[t] = (tickerCount[t] || 0) + 1;
    }
  }

  return signals.map((sig, i) => {
    const tkr  = tickers[i];
    const cnt  = tickerCount[tkr] || 0;
    if (cnt === 0) return sig;                  // no news → untouched
    const raw  = tickerScore[tkr] / cnt;        // avg sentiment in [-1, +1]
    const mult = raw > 0
      ? 1 + newsBoost * Math.min(raw, 1)        // positive: up to +12%
      : 1 + newsDamp  * Math.max(raw, -1);      // negative: up to -25%
    return sig * mult;
  });
}

// ─── Option B: News-flow regime / risk-filter ──────────────────────────────────
// If today's news is heavily negative (>negThresh fraction), treat it like a
// stress event and return a scale factor < 1 to shrink position sizes.
// Mirrors how regimeScale() and the DD-shield work.

function computeNewsSentimentRegimeScale(newsItems, {
  staleDays   = 3,    // look at items from the last N days
  negThreshold = 0.40, // >40% negative → stress-like scaling
  crsThreshold = 0.60, // >60% negative → crisis-like scaling
  stressScale  = 0.75, // position scale when news is "stress"
  crisisScale  = 0.45, // position scale when news is "crisis"
} = {}) {
  if (!newsItems || newsItems.length === 0) return { scale: 1, label: "neutral", negFrac: 0 };

  const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString().slice(0,10);
  const recent = newsItems.filter(n => !n.date || n.date >= cutoff);
  if (recent.length < 3) return { scale: 1, label: "insufficient", negFrac: 0 }; // need at least 3 items

  // Source weight: macro/NRB items are 4x more market-moving than single company news
  const sourceWeight = (item) => {
    if (item.category === "monetary_policy" || item.source === "NRB") return 4;
    if (item.category === "Macro" || item.category === "Political") return 2;
    return 1;
  };

  let negW = 0, totalW = 0;
  for (const n of recent) {
    const w = sourceWeight(n);
    totalW += w;
    if (n.sentiment_hint === "negative") negW += w;
  }
  const negFrac = totalW > 0 ? negW / totalW : 0;

  if (negFrac >= crsThreshold) return { scale: crisisScale, label: "crisis",  negFrac };
  if (negFrac >= negThreshold) return { scale: stressScale, label: "stress",  negFrac };
  return                              { scale: 1,            label: "positive", negFrac };
}

// OPTIMAL TUNED PARAMETERS for NEPSE daily equity data
// win=240    → longer lookback = more stable correlation/regime estimates
// txCost=0.0015 → NEPSE realistic round-trip cost (~15 bps)
// momBlend=0.35 → balanced trend/topology mix (sweet spot)
// txCost default: ~0.45% one-way (broker 0.36% max + SEBON 0.015% + NEPSE fee 0.072% + DP) ≈ 0.0045

export { applyNewsSentimentOverlay, computeNewsSentimentRegimeScale };
