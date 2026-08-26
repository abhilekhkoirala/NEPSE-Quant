import { useMemo } from "react";
import { K, SP, RADIUS, FALLBACK_SEC_NAMES, buildSecColors } from "../../components/common/theme.js";
import { FlashCell } from "../../components/common/FlashCell.jsx";
import { Sparkline } from "../../components/charts/Sparkline.jsx";

// Uses the 60-day sparkline path precomputed by the backend
// (signalData[i].sparkline60 — see pipelineService.js) instead of
// deriving it from a full raw-returns matrix shipped to the browser.
function Watchlist({ result }) {
  const secNames = result.sectorNames || FALLBACK_SEC_NAMES, secColors = buildSecColors(secNames);
  const rows = useMemo(() => result.signalData.map(d => {
    const path = d.sparkline60 || [1];
    const chg = path.length > 1 ? path[path.length - 1] / path[0] - 1 : 0;
    const secIdx = secNames.indexOf(d.sector);
    return { ...d, path, chg, secColor: secColors[secIdx === -1 ? 0 : secIdx] ?? K.textMuted };
  }), [result.signalData, secNames, secColors]);

  if (rows.length === 0) {
    return <div style={{ padding: SP.lg, fontSize: 13, color: K.textSecondary }}>No tickers currently pass the active liquidity/quality filters — loosen the thresholds in Strategy Parameters to repopulate the watchlist.</div>;
  }
  return (
    <div className="grid-table-scroll">
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
      <thead>
        <tr style={{ textAlign: "left", color: K.textMuted, fontSize: 11 }}>
          <th style={{ padding: `${SP.sm}px ${SP.lg}px`, fontWeight: 500 }}>Ticker</th>
          <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500 }}>Sector</th>
          <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>Price</th>
          <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>60D</th>
          <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500 }}>Trend</th>
          <th style={{ padding: `${SP.sm}px ${SP.sm}px`, fontWeight: 500, textAlign: "right" }}>Signal</th>
          <th style={{ padding: `${SP.sm}px ${SP.lg}px`, fontWeight: 500, textAlign: "right" }}>Weight</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.ticker} className="table-row" style={{ borderTop: `1px solid ${K.border}` }}>
            <td style={{ padding: `${SP.sm}px ${SP.lg}px`, fontFamily: K.fontMono, color: K.text, fontWeight: 600 }}>{r.ticker}</td>
            <td style={{ padding: `${SP.sm}px ${SP.sm}px` }}><span style={{ fontSize: 11, color: r.secColor, border: `1px solid ${r.secColor}4D`, borderRadius: RADIUS.sm, padding: "2px 7px" }}>{r.sector}</span></td>
            <td style={{ padding: `${SP.sm}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: K.textSecondary }}><FlashCell value={result.lastPriceByTicker?.[r.ticker]} format={v => v ? v.toFixed(2) : "—"} /></td>
            <td style={{ padding: `${SP.sm}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: r.chg >= 0 ? K.positive : K.negative }}>{(r.chg * 100).toFixed(1)}%</td>
            <td style={{ padding: `${SP.sm}px ${SP.sm}px` }}><Sparkline data={r.path} color={r.chg >= 0 ? K.positive : K.negative} /></td>
            <td style={{ padding: `${SP.sm}px ${SP.sm}px`, textAlign: "right", fontFamily: K.fontMono, color: K.textSecondary }}>{r.signal.toFixed(2)}</td>
            <td style={{ padding: `${SP.sm}px ${SP.lg}px`, textAlign: "right", fontFamily: K.fontMono, color: K.text }}>{(r.weight * 100).toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export { Watchlist };
