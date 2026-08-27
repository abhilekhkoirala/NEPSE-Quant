import { useState, useEffect, useCallback } from "react";
import { K, SP, RADIUS } from "./components/common/theme.js";
import { NavItem } from "./components/navigation/NavItem.jsx";
import { Loading } from "./components/layout/Loading.jsx";
import { PageHeader } from "./components/layout/PageHeader.jsx";
import { Overview } from "./features/overview/Overview.jsx";
import { Signals } from "./features/signals/Signals.jsx";
import { Regime } from "./features/regime/Regime.jsx";
import { PortfolioPage } from "./features/portfolio/PortfolioPage.jsx";
import { IPOTab } from "./features/ipo/IPOTab.jsx";
import { AIAnalysis } from "./features/ai/AIAnalysis.jsx";
import stocksApi from "./lib/api/stocks.js";
import signalsApi from "./lib/api/signals.js";
import regimeApi from "./lib/api/regime.js";
import backtestsApi from "./lib/api/backtests.js";
import newsApi from "./lib/api/news.js";
import portfolioApi from "./lib/api/portfolio.js";
import { DEFAULT_PARAMS } from "./lib/api/defaultParams.js";

// Six top-level destinations. The four portfolio-related tools that used
// to be separate nav items (Portfolio, Optimal Holdings, Cash Allocator,
// Bridge Trades) now live as secondary tabs inside the Portfolio page
// (see PortfolioPage.jsx) — same components, same props, just reached
// through one nav entry instead of four.
const TABS = [
  { id: "overview", navLabel: "Overview", title: "Overview" },
  { id: "signals", navLabel: "Signals", title: "Signals" },
  { id: "regime", navLabel: "Regime", title: "Regime" },
  { id: "portfolio", navLabel: "Portfolio", title: "Portfolio" },
  { id: "ipo", navLabel: "IPO", title: "IPO" },
  { id: "ai analysis", navLabel: "AI Analyst", title: "AI Analyst" },
];

function formatComputedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function formatClock(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Combines the several per-domain API responses (signals, regime,
// backtest, news) into the single `result` shape the tab components
// expect — a stand-in for what used to be one in-browser
// computeWithData() call. Each piece is genuinely a separate backend
// concern now (see backend/src/api/*.js); this is just view assembly,
// not computation.
function composeResult({ backtest, signals, regime, regimeHistory, sentiment, stocks }) {
  const lastPriceByTicker = Object.fromEntries(stocks.stocks.map(s => [s.ticker, s.price]));
  return {
    id: backtest.id,
    computedAt: backtest.computedAt,
    params: backtest.params,
    m: backtest.metrics,
    curve: backtest.curve,
    periods: backtest.periods,
    periodTotals: backtest.periodTotals,
    cgtShortTermRate: backtest.cgtShortTermRate,
    lastRegime: backtest.lastRegime,
    tickers: regime.tickers,
    corr: regime.corr,
    homoData: regime.homoData,
    terrain: regime.terrain,
    regimeSeries: regimeHistory.regimeSeries,
    signalData: signals.signalData,
    prevSignals: signals.prevSignals,
    newsSentiment: sentiment,
    sectorNames: stocks.sectorNames,
    lastPriceByTicker,
  };
}

async function fetchComposedResult() {
  const [signals, regime, regimeHistory, sentiment, stocks] = await Promise.all([
    signalsApi.getSignals(), regimeApi.getRegime(), regimeApi.getHistory(),
    newsApi.getSentiment(), stocksApi.getStocks(),
  ]);
  const backtest = await backtestsApi.getCurrent();
  return composeResult({ backtest, signals, regime, regimeHistory, sentiment, stocks });
}

export default function App() {
  const [status, setStatus] = useState({ phase: "Connecting to backend…", pct: 10 });
  const [result, setResult] = useState(null);
  const [fatalError, setFatalError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [tabRevealed, setTabRevealed] = useState(false);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [running, setRunning] = useState(false);
  const [dataWarning, setDataWarning] = useState(null);
  const [newsData, setNewsData] = useState([]);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [portfolioVersion, setPortfolioVersion] = useState(0);

  useEffect(() => {
    setTabRevealed(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setTabRevealed(true)));
    return () => cancelAnimationFrame(id);
  }, [tab]);

  const runPipeline = useCallback(async (p) => {
    setRunning(true);
    try {
      setStatus({ phase: "Walk-forward OOS · Ensemble Signal…", pct: 60 });
      await backtestsApi.run(p);
      const composed = await fetchComposedResult();
      setResult(composed);
      setParams(p);
    } catch (err) {
      setDataWarning(`Backtest run failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        setStatus({ phase: "Loading price data…", pct: 20 });
        let stocksOk = false;
        try {
          await stocksApi.getStocks();
          stocksOk = true;
        } catch (err) {
          if (err.code === "NO_DATA") {
            setStatus({ phase: "No cached data — running scraper…", pct: 30 });
            await stocksApi.refresh();
            await stocksApi.getStocks();
            stocksOk = true;
          } else {
            throw err;
          }
        }
        if (!stocksOk) throw new Error("Could not load stock data.");

        const news = await newsApi.getNews().catch(() => ({ items: [] }));
        setNewsData(news.items || []);

        setStatus({ phase: "Rolling topological regime series…", pct: 45 });
        await backtestsApi.run(DEFAULT_PARAMS);
        const composed = await fetchComposedResult();
        setResult(composed);

        const holdings = await portfolioApi.getHoldings().catch(() => null);
        if (holdings) setPortfolioCount(holdings.count);
      } catch (err) {
        console.error("Boot failed:", err);
        setFatalError(
          err.message?.includes("fetch")
            ? "Could not reach the backend API. Make sure it's running (see backend/README) and VITE_API_BASE in frontend/.env points at it."
            : err.message || "Something went wrong loading the app."
        );
      }
    }
    boot();
  }, []);

  const handlePortfolioUploaded = useCallback(async () => {
    setPortfolioVersion(v => v + 1);
    const holdings = await portfolioApi.getHoldings().catch(() => null);
    if (holdings) setPortfolioCount(holdings.count);
  }, []);

  if (fatalError) {
    return (<div style={{ minHeight: "100vh", background: K.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: SP.xl }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: K.text, marginBottom: SP.md }}>Unable to load NEPSEQuant</div>
        <div style={{ fontSize: 14, color: K.negative, marginBottom: SP.md, lineHeight: 1.6 }}>{fatalError}</div>
        <div style={{ fontSize: 13, color: K.textSecondary, lineHeight: 1.7, marginBottom: SP.xl }}>
          This build talks to a separate backend over HTTP — start it with <code style={{ fontFamily: K.fontMono, fontSize: 12.5, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "2px 7px", color: K.text }}>cd backend && npm start</code>.
        </div>
        <button onClick={() => window.location.reload()} className="btn btn-primary">Reload</button>
      </div>
    </div>);
  }

  if (!result) return <Loading phase={status.phase} pct={status.pct} />;

  const activeTab = TABS.find(t => t.id === tab);
  const regimeLabel = { calm: "Calm", stress: "Stress", crisis: "Crisis", fragmented: "Fragmented" }[result.lastRegime] || "—";
  const subtitleByTab = {
    overview: `Ensemble · T+1 · Last run ${formatComputedAt(result.computedAt) || "—"}`,
    signals: `${result.signalData.length} stocks`,
    regime: regimeLabel,
    portfolio: portfolioCount > 0 ? `${portfolioCount} holdings imported` : "No holdings imported",
    ipo: "Open & upcoming issues",
    "ai analysis": `Ensemble · ${result.signalData.length} stocks · ${regimeLabel}`,
  };

  return (<div className="app-shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: K.bg, fontFamily: K.fontUI, color: K.text }}>
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/favicon.svg" alt="" width={20} height={20} style={{ display: "block", borderRadius: 4 }} />
        NEPSEQuant
      </div>
      <nav className="topbar-nav">
        {TABS.map(t => <NavItem key={t.id} label={t.navLabel} active={t.id === tab} onClick={() => setTab(t.id)} />)}
      </nav>
      <div className="topbar-status">
        <span>Data<span className="v">{formatClock(result.computedAt) || "—"}</span></span>
        <span>{result.tickers.length}<span style={{ marginLeft: 4 }}>stocks</span></span>
        <span>Risk shield <span style={{ color: K.positive, fontWeight: 600 }}>ON</span></span>
      </div>
    </header>

    <main className="workspace" style={{ flex: 1, padding: `${SP.xl}px`, maxWidth: 1440, width: "100%", margin: "0 auto" }}>
      {dataWarning && (
        <div style={{ marginBottom: SP.lg, padding: `${SP.sm + 2}px ${SP.lg}px`, background: `${K.negative}1A`, border: `1px solid ${K.negative}4D`, borderRadius: RADIUS.md, fontSize: 13, color: K.negative, display: "flex", justifyContent: "space-between", alignItems: "center", gap: SP.md }}>
          <span>{dataWarning}</span>
          <button onClick={() => setDataWarning(null)} style={{ background: "none", border: "none", color: K.negative, cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
      )}

      <PageHeader title={activeTab?.title} subtitle={subtitleByTab[tab]} />

      <div key={tab} className={`reveal${tabRevealed ? " in-view" : ""}`}>
        {tab === "overview" && <Overview result={result} params={params} setParams={setParams} onRun={runPipeline} running={running} />}
        {tab === "signals" && <Signals result={result} newsData={newsData} />}
        {tab === "regime" && <Regime result={result} newsData={newsData} />}
        {tab === "portfolio" && <PortfolioPage result={result} userPortfolioCount={portfolioCount} refreshKey={portfolioVersion} onUploaded={handlePortfolioUploaded} />}
        {tab === "ipo" && <IPOTab result={result} />}
        {tab === "ai analysis" && <AIAnalysis result={result} newsData={newsData} />}
      </div>
    </main>
  </div>);
}
