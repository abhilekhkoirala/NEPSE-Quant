// Fetches live price / P/E / ROE from merolagani.com as a fallback for
// tickers missing from the scraped price CSV (used by Bridge Trades and
// the per-ticker Fundamentals panel). Moved from src/App.jsx, where it ran
// directly in the browser — that made it fail under CORS from many
// networks (the frontend's own error text used to say so) and meant the
// browser held a fetch loop keyed to a third-party site. Running it here
// is the same request, no CORS exposure, and one place to add a timeout,
// retry, or swap providers later.
//
// A short in-memory TTL cache is added (same pattern already used for the
// IPO cache in the original server.js) so Bridge Trades + Fundamentals
// panel don't refetch the same ticker on every request.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _cache = new Map(); // symbol → { data, time }

async function fetchMerolaganiPrice(symbol) {
  const profile = await fetchMerolaganiProfile(symbol);
  return profile ? profile.price : null;
}

// Fetches price, P/E ratio, and ROE from the merolagani CompanyDetail page.
async function fetchMerolaganiProfile(symbol) {
  try {
    const res = await fetch(`https://merolagani.com/CompanyDetail.aspx?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const html = await res.text();

    // Helper: extract a numeric value after a label in a table
    function extractField(label) {
      // Matches: <td>...label...</td><td>...<b>VALUE</b>...</td>  or plain text
      const re = new RegExp(label + '[\\s\\S]{0,300}?<(?:b|strong)>([\\d,\\.\\-]+)<\\/(?:b|strong)>', 'i');
      const m = html.match(re)
        || html.match(new RegExp(label + '[^|<]{0,60}?([\\d,\\.]+)', 'i'));
      if (!m) return null;
      const v = parseFloat(m[1].replace(/,/g, ''));
      return isFinite(v) ? v : null;
    }

    const price = extractField('Market Price');
    const pe    = extractField('P\\/E Ratio') ?? extractField('PE Ratio') ?? extractField('Price Earnings Ratio');
    const roe   = extractField('Return on Equity') ?? extractField('ROE');

    if (!price || price <= 0) return null;
    return { price, pe: pe ?? null, roe: roe ?? null };
  } catch { return null; }
}


async function fetchMerolaganiProfileCached(symbol) {
  const now = Date.now();
  const hit = _cache.get(symbol);
  if (hit && now - hit.time < CACHE_TTL_MS) return hit.data;
  const data = await fetchMerolaganiProfile(symbol);
  _cache.set(symbol, { data, time: now });
  return data;
}

export { fetchMerolaganiPrice, fetchMerolaganiProfile, fetchMerolaganiProfileCached };
