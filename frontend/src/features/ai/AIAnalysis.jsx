import { useState, useRef } from "react";
import { K, SP, RADIUS } from "../../components/common/theme.js";
import { Panel, SL } from "../../components/layout/Panel.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import aiApi from "../../lib/api/ai.js";

// The system-context string (quant metrics + regime + news headlines) used
// to be assembled here in the browser and sent alongside the chat history
// to a /api/gemini proxy that only forwarded the Gemini key. Per the
// architecture brief's AI section — "the AI should receive structured
// application context from the backend rather than independently fetching
// sensitive data" — that assembly now happens server-side, from the
// backend's own cached pipeline result and news feed (see
// backend/src/services/geminiService.js). This component only ever sends
// { history }; the API key never touches the browser either way.
function AIAnalysis({ result, newsData = [] }) {
  const [loading, setLoading] = useState(false), [error, setError] = useState(null), [query, setQuery] = useState(""), [history, setHistory] = useState([]);
  const bottomRef = useRef(null);
  const recentNews = newsData.slice(0, 50);

  async function ask(q) {
    if (!q.trim()) return;
    const msg = { role: "user", content: q }, nh = [...history, msg];
    setHistory(nh); setQuery(""); setLoading(true); setError(null);
    try {
      const reply = await aiApi.analyze(nh);
      setHistory([...nh, reply]);
    } catch (e) {
      setError(e.message || "API error");
    } finally { setLoading(false); }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  const sentColor = { positive: K.positive, negative: K.negative, neutral: K.textMuted };

  return (
    <div className="grid-responsive" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: SP.lg }}>
      <Panel style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
        <SL right={newsData.length > 0 ? `${newsData.length} news items loaded` : "Price data only"}>AI Analyst · Gemini</SL>
        <div style={{ flex: 1, overflowY: "auto", marginBottom: SP.md, maxHeight: 440 }}>
          {history.length === 0 && (
            <div style={{ padding: "20px 0" }}>
              <div style={{ color: K.textMuted, marginBottom: SP.sm, fontSize: 11 }}>Suggested queries</div>
              {[
                "Which stocks in my universe have the strongest positive news sentiment right now?",
                "Are there any tickers with bearish news that contradict the quant signals?",
                "Given current regime and news flow, what sector risks should I watch?",
                "Summarise recent news for the banking sector.",
                "Should I be worried about any regulatory or policy news affecting NEPSE?",
              ].map(s => (
                <div key={s} onClick={() => ask(s)} className="table-row" style={{ padding: `${SP.sm}px ${SP.md}px`, marginBottom: SP.xs, background: K.surfaceElevated, borderRadius: RADIUS.sm, cursor: "pointer", fontSize: 12.5, border: `1px solid ${K.border}`, color: K.textSecondary, lineHeight: 1.5 }}>
                  {s}
                </div>
              ))}
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: m.role === "user" ? K.surfaceElevated : K.surface, border: `1px solid ${K.border}`, borderLeft: `2px solid ${m.role === "user" ? K.accent : K.textMuted}`, borderRadius: RADIUS.sm }}>
              <div style={{ fontSize: 11, color: m.role === "user" ? K.accent : K.textMuted, marginBottom: 5 }}>{m.role === "user" ? "You" : "Gemini"}</div>
              <div style={{ fontSize: 13.5, color: K.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
          {loading && <div style={{ fontSize: 13, color: K.textSecondary }}>Analyzing market data and news…</div>}
          {error && <div style={{ fontSize: 12.5, color: K.negative }}>{error}</div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: "flex", gap: SP.sm }}>
          <input className="input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && ask(query)} placeholder="Ask about risks, news impact, sector moves…" style={{ flex: 1, fontSize: 13 }} />
          <button onClick={() => ask(query)} disabled={loading || !query.trim()} className="btn btn-primary">Ask</button>
        </div>
      </Panel>

      <Panel style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
        <SL right={`${recentNews.length} items`}>News Feed · NEPSE</SL>
        {recentNews.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <EmptyState
              title="No news loaded"
              description={<>Run <code style={{ fontFamily: K.fontMono, fontSize: 12, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "1px 6px", color: K.text }}>scrape_nepse.py</code> to populate <code style={{ fontFamily: K.fontMono, fontSize: 12, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "1px 6px", color: K.text }}>nepse_news.json</code>, then expose it via <code style={{ fontFamily: K.fontMono, fontSize: 12, background: K.surfaceElevated, border: `1px solid ${K.border}`, borderRadius: RADIUS.sm, padding: "1px 6px", color: K.text }}>/api/news</code></>}
            />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 480 }}>
            {(() => {
              const pos = recentNews.filter(n => n.sentiment_hint === "positive").length;
              const neg = recentNews.filter(n => n.sentiment_hint === "negative").length;
              const neu = recentNews.filter(n => n.sentiment_hint === "neutral").length;
              const total = recentNews.length || 1;
              return (
                <div style={{ marginBottom: SP.md, padding: `${SP.sm}px ${SP.md}px`, background: K.surfaceElevated, borderRadius: RADIUS.sm, border: `1px solid ${K.border}` }}>
                  <div style={{ fontSize: 11, color: K.textMuted, marginBottom: SP.sm }}>News sentiment overview</div>
                  <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
                    <div style={{ width: `${pos / total * 100}%`, background: K.positive }} />
                    <div style={{ width: `${neg / total * 100}%`, background: K.negative }} />
                    <div style={{ width: `${neu / total * 100}%`, background: K.border }} />
                  </div>
                  <div style={{ display: "flex", gap: SP.sm + 2, marginTop: SP.xs, fontSize: 11.5 }}>
                    <span style={{ color: K.positive }}>{pos} positive</span>
                    <span style={{ color: K.negative }}>{neg} negative</span>
                    <span style={{ color: K.textMuted }}>{neu} neutral</span>
                  </div>
                </div>
              );
            })()}
            {recentNews.map((n, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${K.border}`, paddingBottom: SP.sm, marginBottom: SP.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: K.textMuted }}>{n.source}</span>
                  <span style={{ fontSize: 11, color: sentColor[n.sentiment_hint] || K.textMuted }}>
                    {n.sentiment_hint}
                  </span>
                </div>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="table-row"
                  style={{ fontSize: 13, color: K.text, lineHeight: 1.5, display: "block", textDecoration: "none", borderRadius: RADIUS.sm }}>
                  {n.title}
                </a>
                {n.tickers_mentioned?.length > 0 && (
                  <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {n.tickers_mentioned.map(t => (
                      <span key={t} style={{ fontSize: 11, padding: "2px 7px", background: K.accentSoft, color: K.accent, borderRadius: RADIUS.sm, border: `1px solid ${K.accentBorder}`, fontFamily: K.fontMono }}>{t}</span>
                    ))}
                  </div>
                )}
                {n.date && <div style={{ fontSize: 11, color: K.textMuted, marginTop: 4 }}>{n.date}</div>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export { AIAnalysis };
