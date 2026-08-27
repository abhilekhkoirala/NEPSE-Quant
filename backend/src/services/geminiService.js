// Gemini proxy + system-context assembly for the AI Analyst tab. The
// browser used to build this same systemCtx string itself (reading
// result.m / result.tickers / regimeSeries / newsData directly) and send
// it alongside the API key's own /api/gemini call. Per the architecture
// principle in the brief — "the AI should receive structured application
// context from the backend rather than independently fetching sensitive
// data" — that assembly now happens here, from the server's own cached
// pipeline result and news feed; the frontend only sends the chat
// history. The API key never leaves the server either way (that part was
// already correct in the original server.js).
import { getCurrent } from "./pipelineService.js";
import { loadNews } from "./newsService.js";

const GEMINI_MODEL = "gemini-1.5-flash";

function buildSystemContext() {
  const result = getCurrent();
  if (!result) {
    return "You are a NEPSE quantitative analyst for the TopoQuant v6.0 engine. No backtest has been run yet in this session, so no quantitative metrics are available — let the user know a run is needed first.";
  }
  const last = result.regimeSeries[result.regimeSeries.length - 1] || {};
  const news = loadNews();
  const recentNews = (news.items || []).slice(0, 50);

  const newsCtxLines = recentNews.map(n => {
    const tkr = n.tickers_mentioned?.length ? ` [${n.tickers_mentioned.join(",")}]` : "";
    const sent = n.sentiment_hint ? ` (${n.sentiment_hint})` : "";
    return `• ${n.date ? n.date + " — " : ""}${n.title}${tkr}${sent}`;
  });
  const newsCtxBlock = newsCtxLines.length > 0
    ? `\n\nRecent NEPSE Market News (${newsCtxLines.length} items, newest first):\n${newsCtxLines.join("\n")}\n\nUse the above headlines as qualitative context when answering. Cross-reference tickers mentioned in headlines with the quantitative signals. Note that sentiment_hint is keyword-based only — apply proper analytical judgement.`
    : "\n\n(No live news data loaded — analysis is based on price/quantitative data only.)";

  return `You are a NEPSE quantitative analyst for the TopoQuant v6.0 engine.\n\nQuantitative Metrics:\n- Annualised Return: ${result.m.annRet}%\n- Sharpe Ratio: ${result.m.sharpe}\n- Max Drawdown: ${result.m.maxDD}%\n- Benchmark Return: ${result.m.benRet}%\n- Hit Rate: ${result.m.hitRate}%\n- Ann. Volatility: ${result.m.annVol}%\nCurrent Market Regime: ${last.regime?.toUpperCase() || "CALM"}\nEnsemble Signal: Active | Risk Shield: Active\nUniverse: ${result.tickers.length} liquid NEPSE stocks${newsCtxBlock}`;
}

async function ask(history) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY not set in server environment");
    err.code = "NO_API_KEY";
    throw err;
  }
  const systemCtx = buildSystemContext();
  const contents = history.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemCtx }] },
      generationConfig: { maxOutputTokens: 1000, temperature: 0.2 },
    }),
  });
  const data = await response.json();
  if (data.error) {
    const err = new Error(data.error.message);
    err.code = "GEMINI_ERROR";
    throw err;
  }
  return data.candidates[0].content.parts[0].text;
}

export { ask, buildSystemContext };
