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
// panel don't refetch the same ticker on every request. Only successful
// fetches are cached — an earlier version also cached null on failure for
// the full TTL, which meant the frontend's "Retry" button did nothing for
// up to 5 minutes (it was just reading the same cached failure back).

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — successful results only
const FETCH_TIMEOUT_MS = 8000;
const _cache = new Map(); // symbol → { result: {profile, reason}, time }

// A real browser UA + Accept headers — merolagani.com (like a lot of
// sites) is more likely to block or serve a stripped page to a request
// with no User-Agent at all, which is what an undecorated `fetch()` sends.
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchMerolaganiPrice(symbol) {
  const profile = await fetchMerolaganiProfile(symbol);
  return profile ? profile.price : null;
}

// Fetches price, P/E ratio, and ROE from the merolagani CompanyDetail page.
async function fetchMerolaganiProfile(symbol) {
  const { profile } = await fetchMerolaganiProfileWithReason(symbol);
  return profile;
}

// Same as fetchMerolaganiProfile but also reports *why* it failed, so
// callers that surface the error to a user (the fundamentals API route)
// can say something more useful than a blanket "could not reach":
//   "timeout"     — merolagani.com didn't respond within FETCH_TIMEOUT_MS
//   "unreachable" — network/DNS failure, request never got a response
//   "blocked"     — got a response, but a non-2xx status (rate-limit/WAF)
//   "unparsable"  — got a normal 200 page, but couldn't find the price
//                   field in it — most likely the page markup changed
// Every failure is also console.error'd server-side so it isn't silently
// invisible in the logs the way a bare `catch { return null }` was.
async function fetchMerolaganiProfileWithReason(symbol) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://merolagani.com/CompanyDetail.aspx?symbol=${encodeURIComponent(symbol)}`, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[externalFetch] merolagani ${symbol}: HTTP ${res.status} ${res.statusText}`);
      return { profile: null, reason: "blocked" };
    }
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

    if (!price || price <= 0) {
      console.error(`[externalFetch] merolagani ${symbol}: got HTTP ${res.status} (${html.length} bytes) but no "Market Price" field matched — page markup likely changed`);
      return { profile: null, reason: "unparsable" };
    }
    return { profile: { price, pe: pe ?? null, roe: roe ?? null }, reason: null };
  } catch (err) {
    const reason = err.name === "AbortError" ? "timeout" : "unreachable";
    console.error(`[externalFetch] merolagani ${symbol}: ${reason} — ${err.message}`);
    return { profile: null, reason };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMerolaganiProfileCached(symbol) {
  const { profile } = await fetchMerolaganiProfileCachedWithReason(symbol);
  return profile;
}

async function fetchMerolaganiProfileCachedWithReason(symbol) {
  const now = Date.now();
  const hit = _cache.get(symbol);
  if (hit && now - hit.time < CACHE_TTL_MS) return hit.result;
  const result = await fetchMerolaganiProfileWithReason(symbol);
  if (result.profile) _cache.set(symbol, { result, time: now }); // don't cache failures
  return result;
}

export { fetchMerolaganiPrice, fetchMerolaganiProfile, fetchMerolaganiProfileCached, fetchMerolaganiProfileCachedWithReason };