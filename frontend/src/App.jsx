import { useState, useEffect, useCallback } from "react";
import { K, SP, RADIUS } from "./components/common/theme.js";
import { NavItem } from "./components/navigation/NavItem.jsx";
import { Loading } from "./components/layout/Loading.jsx";
import { Panel, SL } from "./components/layout/Panel.jsx";
import { CollapsiblePanel } from "./components/common/CollapsiblePanel.jsx";
import { RegimeTerrain } from "./components/charts/RegimeTerrain.jsx";
import { OverviewIcon, SignalsIcon, RegimeIcon, IPOIcon, PortfolioIcon, OptimalIcon, CashIcon, BridgeIcon, AIIcon } from "./components/common/icons.jsx";
import { Watchlist } from "./features/regime/Watchlist.jsx";
import { PortfolioSnapshot } from "./features/portfolio/PortfolioSnapshot.jsx";
import { PortfolioUpload } from "./features/portfolio/PortfolioUpload.jsx";
import { PortfolioTab } from "./features/portfolio/PortfolioTab.jsx";
import { OptimalHoldings } from "./features/portfolio/OptimalHoldings.jsx";
import { CashAllocator } from "./features/portfolio/CashAllocator.jsx";
import { BridgeTrades } from "./features/portfolio/BridgeTrades.jsx";
import { Overview } from "./features/overview/Overview.jsx";
import { Signals } from "./features/signals/Signals.jsx";
import { Regime } from "./features/regime/Regime.jsx";
import { Params } from "./features/backtests/Params.jsx";
import { IPOTab } from "./features/ipo/IPOTab.jsx";
import { AIAnalysis } from "./features/ai/AIAnalysis.jsx";
import { useIsMobile } from "./lib/utilities/useIsMobile.js";
import stocksApi from "./lib/api/stocks.js";
import signalsApi from "./lib/api/signals.js";
import regimeApi from "./lib/api/regime.js";
import backtestsApi from "./lib/api/backtests.js";
import newsApi from "./lib/api/news.js";
import portfolioApi from "./lib/api/portfolio.js";
import { DEFAULT_PARAMS } from "./lib/api/defaultParams.js";

// Page title/subtitle are the nav's own concern (short, orientation-only)
// separate from the header's — see section 13/14 of the redesign brief.
const TABS = [
  { id: "overview", navLabel: "Overview", icon: OverviewIcon, title: "Backtest Results", subtitle: "Evaluate strategy performance against the NEPSE benchmark" },
  { id: "signals", navLabel: "Signals", icon: SignalsIcon, group: "Markets", title: "Signals", subtitle: "Ranked mispricing estimates across the active universe" },
  { id: "regime", navLabel: "Regime", icon: RegimeIcon, group: "Markets", title: "Regime", subtitle: "Market structure, correlation regime, and the news-sentiment filter" },
  { id: "ipo", navLabel: "IPO", icon: IPOIcon, group: "Markets", title: "IPO", subtitle: "Upcoming and open issues, scored against fundamentals" },
  { id: "portfolio", navLabel: "Portfolio", icon: PortfolioIcon, group: "Portfolio", title: "Portfolio", subtitle: "Your current holdings, weighed against the strategy" },
  { id: "optimal holdings", navLabel: "Optimal Holdings", icon: OptimalIcon, group: "Portfolio", title: "Optimal Holdings", subtitle: "Target allocation from the current strategy run" },
  { id: "cash allocator", navLabel: "Cash Allocator", icon: CashIcon, group: "Portfolio", title: "Cash Allocator", subtitle: "Deploy new cash into the current strategy" },
  { id: "bridge trades", navLabel: "Bridge Trades", icon: BridgeIcon, group: "Portfolio", title: "Bridge Trades", subtitle: "Trades that bridge your current holdings to the target allocation" },
  { id: "ai analysis", navLabel: "AI Analyst", icon: AIIcon, title: "AI Analyst", subtitle: "Ask questions about the current run and today's news" },
];

function formatComputedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
  const isMobile = useIsMobile();

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
        if (!stocksOk) throw new Error("Could not load price data");

        const [news] = await Promise.all([
          newsApi.getNews().catch(() => ({ items: [] })),
        ]);
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
        <div style={{ fontSize: 15, fontWeight: 600, color: K.text, marginBottom: SP.md }}>Unable to load TopoQuant</div>
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
  const ns = result?.newsSentiment;
  const nsColor = ns ? (ns.label === "crisis" ? K.negative : ns.label === "stress" ? K.warning : K.positive) : K.textMuted;

  return (<div className="app-shell" style={{ display: "flex", minHeight: "100vh", background: K.bg, fontFamily: K.fontUI, color: K.text }}>
    <nav className="app-nav" style={{ width: 236, flexShrink: 0, borderRight: `1px solid ${K.border}`, background: K.surface, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
      <div className="app-nav-logo" style={{ padding: `${SP.lg}px ${SP.lg}px ${SP.md}px`, borderBottom: `1px solid ${K.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: K.text }}>TopoQuant</div>
        <div className="app-nav-logo-sub" style={{ fontSize: 11.5, color: K.textMuted, marginTop: 2 }}>Quantitative Research</div>
      </div>
      <div className="app-nav-items" style={{ flex: 1, padding: `${SP.sm}px 0` }}>
        {(() => {
          let lastGroup = undefined;
          return TABS.map(t => {
            const showGroupLabel = t.group && t.group !== lastGroup;
            lastGroup = t.group;
            return (
              <div key={t.id}>
                {showGroupLabel && <div className="nav-group-label">{t.group}</div>}
                <NavItem icon={t.icon} label={t.navLabel} active={t.id === tab} onClick={() => setTab(t.id)} />
              </div>
            );
          });
        })()}
      </div>
      <div className="app-nav-status" style={{ padding: `${SP.md}px ${SP.lg}px`, borderTop: `1px solid ${K.border}`, fontSize: 12, color: K.textMuted }}>
        <span style={{ fontFamily: K.fontMono, color: K.textSecondary }}>{result.tickers.length}</span> tickers tracked
      </div>
    </nav>

    <div className="app-dash" style={{ width: 420, flexShrink: 0, borderRight: `1px solid ${K.border}`, background: K.bg, display: "flex", flexDirection: "column", gap: SP.md, padding: SP.md, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
      <RegimeTerrain result={result} />
      <CollapsiblePanel title="Watchlist" right={`${result.signalData.length} tickers`} bodyPadding={0}>
        <Watchlist result={result} />
      </CollapsiblePanel>
      <CollapsiblePanel title="Portfolio & Risk" defaultOpen={!isMobile}>
        <PortfolioSnapshot result={result} />
      </CollapsiblePanel>
    </div>

    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${SP.md}px ${SP.xl}px`, borderBottom: `1px solid ${K.border}`, background: K.bg, position: "sticky", top: 0, zIndex: 5, gap: SP.lg, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: K.text }}>{activeTab?.title}</div>
          <div style={{ fontSize: 12.5, color: K.textMuted, marginTop: 1 }}>{activeTab?.subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: SP.xl, fontSize: 12.5, color: K.textSecondary }}>
          <span>Execution <span style={{ color: K.text }}>T+1</span></span>
          <span>Strategy <span style={{ color: K.text }}>Ensemble</span></span>
          <span>Risk shield <span style={{ color: K.positive }}>Active</span></span>
        </div>
      </header>

      <div style={{ padding: `${SP.xl}px ${SP.xl}px`, flex: 1 }}>
        {dataWarning && (
          <div style={{ marginBottom: SP.lg, padding: `${SP.sm + 2}px ${SP.lg}px`, background: `${K.negative}1A`, border: `1px solid ${K.negative}4D`, borderRadius: RADIUS.md, fontSize: 13, color: K.negative, display: "flex", justifyContent: "space-between", alignItems: "center", gap: SP.md }}>
            <span>{dataWarning}</span>
            <button onClick={() => setDataWarning(null)} style={{ background: "none", border: "none", color: K.negative, cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
        )}
        <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.lg, marginBottom: SP.lg }}>
          <Panel>
            <SL>Market Data</SL>
            <div style={{ fontSize: 13, color: K.textSecondary }}>
              NEPSE price data loaded{formatComputedAt(result.computedAt) ? ` · as of ${formatComputedAt(result.computedAt)}` : ""}
            </div>
            {newsData.length > 0 && ns && (
              <div style={{ marginTop: SP.sm, fontSize: 12.5, color: K.textSecondary }}>
                {newsData.length} news items · Sentiment <span style={{ color: nsColor, fontWeight: 600 }}>{ns.label[0].toUpperCase() + ns.label.slice(1)}</span>
                {ns.negFrac > 0 && <span style={{ color: K.textMuted }}> ({(ns.negFrac * 100).toFixed(0)}% negative)</span>}
                {ns.scale < 1 && <span style={{ color: nsColor }}> · positions scaled to {(ns.scale * 100).toFixed(0)}%</span>}
              </div>
            )}
            {newsData.length === 0 && (
              <div style={{ marginTop: SP.sm, fontSize: 12.5, color: K.textMuted }}>
                No news loaded — run <code style={{ fontFamily: K.fontMono, fontSize: 11.5, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "1px 6px", color: K.text }}>scrape_nepse.py</code> first
              </div>
            )}
          </Panel>
          <Panel>
            <SL>Import Portfolio</SL>
            <PortfolioUpload onUploaded={handlePortfolioUploaded} />
          </Panel>
        </div>
        <Params params={params} setParams={setParams} onRun={runPipeline} running={running} />
        <div key={tab} className={`reveal grid-table-scroll${tabRevealed ? " in-view" : ""}`} style={{ marginTop: SP.xl }}>
          {tab === "overview" && <Overview result={result} />}
          {tab === "signals" && <Signals result={result} newsData={newsData} />}
          {tab === "regime" && <Regime result={result} newsData={newsData} />}
          {tab === "portfolio" && <PortfolioTab result={result} userPortfolioCount={portfolioCount} refreshKey={portfolioVersion} />}
          {tab === "bridge trades" && <BridgeTrades result={result} userPortfolioCount={portfolioCount} refreshKey={portfolioVersion} />}
          {tab === "optimal holdings" && <OptimalHoldings result={result} refreshKey={portfolioVersion} />}
          {tab === "cash allocator" && <CashAllocator result={result} />}
          {tab === "ipo" && <IPOTab result={result} />}
          {tab === "ai analysis" && <AIAnalysis result={result} newsData={newsData} />}
        </div>
      </div>
    </div>
  </div>);
}
