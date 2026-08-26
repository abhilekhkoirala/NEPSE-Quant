// Express app assembly: CORS, JSON body parsing, route mounting, and the
// central error handler. Split out from server.js so tests (or a future
// serverless entry point) can import the app without also starting the
// scheduler / listening on a port.
import express from "express";
import stocksRouter from "./api/stocks.js";
import signalsRouter from "./api/signals.js";
import regimeRouter from "./api/regime.js";
import backtestsRouter from "./api/backtests.js";
import portfolioRouter from "./api/portfolio.js";
import newsRouter from "./api/news.js";
import iposRouter from "./api/ipos.js";
import aiRouter from "./api/ai.js";
import { errorMiddleware } from "./api/_utils.js";

function createApp() {
  const app = express();
  app.use(express.json());

  // CORS — restricted to the configured frontend origin(s), not "*".
  // FRONTEND_ORIGIN can be a comma-separated list for multiple dev ports.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",").map(s => s.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/stocks", stocksRouter);
  app.use("/api/signals", signalsRouter);
  app.use("/api/regime", regimeRouter);
  app.use("/api/backtests", backtestsRouter);
  app.use("/api/portfolio", portfolioRouter);
  app.use("/api/news", newsRouter);
  app.use("/api/ipos", iposRouter);
  app.use("/api/ai", aiRouter);

  app.use(errorMiddleware);
  return app;
}

export { createApp };
