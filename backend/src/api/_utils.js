// Shared route helpers: a consistent {error:{code,message}} JSON shape
// (section 17 of the brief — never leak a raw stack trace or Python
// traceback to the client) and an async-handler wrapper so route bodies
// can just `await` without a try/catch in every single one.
function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Central error-handling middleware — mounted last in app.js. Recognizes
// the handful of typed error codes the services throw and maps them to a
// sensible HTTP status; anything else is a 500 with a generic message
// (the real error is still logged server-side, never sent to the client).
function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error("[api]", err);
  if (err.code === "NO_PIPELINE_RESULT") return sendError(res, 409, err.code, err.message);
  if (err.code === "ALREADY_RUNNING") return sendError(res, 409, err.code, err.message);
  if (err.code === "NO_API_KEY") return sendError(res, 500, err.code, err.message);
  if (err.code === "GEMINI_ERROR") return sendError(res, 502, err.code, "The AI provider returned an error.");
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong processing that request.");
}

export { sendError, asyncRoute, errorMiddleware };
