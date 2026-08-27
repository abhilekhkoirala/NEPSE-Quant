import { useState, useEffect } from "react";
import { K, SP, RADIUS } from "../../components/common/theme.js";
import stocksApi from "../../lib/api/stocks.js";

// P/E + ROE lookup. Moved from a direct browser fetch to merolagani.com
// (which is what produced the original "Could not reach merolagani.com
// (CORS or network)" error text — a real, frequent failure mode from many
// networks) to GET /api/stocks/:ticker/fundamentals, which fetches
// server-side (see backend/src/data/externalFetch.js) and is cached.
// The error message shown below now comes straight from that route's
// response instead of a single hardcoded string, since the backend
// distinguishes timeout / blocked / unreachable / unparsable failures —
// worth reading verbatim rather than collapsing back into one generic line.
function FundamentalsPanel({ ticker, price }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null); setErrorMsg(null);
    if (!ticker) return;
    setLoading(true);
    stocksApi.getFundamentals(ticker).then(d => {
      if (cancelled) return;
      setLoading(false);
      setData(d);
    }).catch(err => { if (!cancelled) { setLoading(false); setErrorMsg(err?.message || "Could not reach merolagani.com right now."); } });
    return () => { cancelled = true; };
  }, [ticker, retryToken]);

  const lmp = data?.price ?? price;
  const pe = data?.pe;
  const roe = data?.roe;

  return (
    <div style={{ marginTop: SP.sm, padding: `${SP.md}px ${SP.md + 2}px`, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm }}>
      <div style={{ fontSize: 11, color: K.textMuted, marginBottom: SP.sm }}>Fundamentals · {ticker} · merolagani.com</div>
      {loading && <div style={{ fontSize: 13, color: K.textSecondary }}>Loading…</div>}
      {errorMsg && (
        <div style={{ display: "flex", alignItems: "center", gap: SP.md, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: K.warning }}>{errorMsg}</span>
          <button onClick={() => setRetryToken(t => t + 1)} className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 12 }}>Retry</button>
        </div>
      )}
      {!loading && !errorMsg && (
        <div style={{ display: "flex", gap: SP.xl, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: K.textMuted, fontSize: 11, marginBottom: 3 }}>LMP (Rs.)</div>
            <div style={{ color: K.text, fontFamily: K.fontMono, fontSize: 15 }}>{lmp ? lmp.toLocaleString() : "—"}</div>
          </div>
          <div>
            <div style={{ color: K.textMuted, fontSize: 11, marginBottom: 3 }}>P/E Ratio</div>
            <div style={{ color: pe ? (pe < 15 ? K.positive : pe < 25 ? K.warning : K.negative) : K.textMuted, fontFamily: K.fontMono, fontSize: 15 }}>
              {pe != null ? pe.toFixed(1) : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: K.textMuted, fontSize: 11, marginBottom: 3 }}>ROE (%)</div>
            <div style={{ color: roe ? (roe >= 15 ? K.positive : roe >= 8 ? K.warning : K.negative) : K.textMuted, fontFamily: K.fontMono, fontSize: 15 }}>
              {roe != null ? roe.toFixed(1) + "%" : "—"}
            </div>
          </div>
          {pe != null && <div style={{ fontSize: 11.5, color: K.textMuted, alignSelf: "flex-end", marginBottom: 2 }}>
            {pe < 15 ? "Cheap" : pe < 25 ? "Fair" : "Expensive"}
            {roe != null && <> · {roe >= 15 ? "Strong ROE" : roe >= 8 ? "Moderate ROE" : "Weak ROE"}</>}
          </div>}
        </div>
      )}
    </div>
  );
}

export { FundamentalsPanel };