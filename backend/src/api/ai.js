// AI Analyst — proxies to Gemini with server-assembled context (current
// quant metrics + regime + news), so the frontend only ever sends chat
// history, never builds the system prompt itself and never sees the API
// key. See services/geminiService.js.
import { Router } from "express";
import { asyncRoute, sendError } from "./_utils.js";
import { ask } from "../services/geminiService.js";

const router = Router();

// POST /api/ai/analyze — body: { history: [{role:"user"|"assistant", content}, ...] }
// Returns the assistant's reply text; the frontend appends it to its own
// displayed history (same pattern as the original AIAnalysis component).
router.post("/analyze", asyncRoute(async (req, res) => {
  const history = req.body?.history;
  if (!Array.isArray(history) || history.length === 0) {
    return sendError(res, 400, "BAD_REQUEST", "Body must include a non-empty `history` array.");
  }
  const reply = await ask(history);
  res.json({ role: "assistant", content: reply });
}));

export default router;
