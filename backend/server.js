// Backend entry point. Run with:
//   node --env-file=.env server.js
// (Node 20.6+loads .env natively — no dotenv dependency needed. The
// original server.js never actually loaded .env at all, which is why
// GEMINI_API_KEY was silently undefined even though a key existed in the
// frontend's .env under the wrong name — see README "Known issues fixed".)
import { createApp } from "./src/app.js";
import { startScheduler } from "./src/workers/scheduler.js";

const PORT = process.env.PORT || 3001;

const app = createApp();
app.listen(PORT, () => console.log(`[server] Running on http://localhost:${PORT}`));

startScheduler();
