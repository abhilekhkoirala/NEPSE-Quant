// Small fetch wrapper shared by every lib/api/*.js module: resolves the
// backend base URL from VITE_API_BASE, parses JSON, and translates the
// backend's {error:{code,message}} shape (see backend/src/api/_utils.js)
// into a JS Error with a `.code` so callers can branch on it (e.g. the
// NO_PIPELINE_RESULT case, which the UI treats as "click Run first"
// rather than a generic failure).
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty body, e.g. some CSV-era endpoints */ }
  if (!res.ok) {
    const err = body?.error || {};
    throw new ApiError(err.code || "UNKNOWN", err.message || `Request failed (${res.status})`, res.status);
  }
  return body;
}

const get = path => request(path, { method: "GET" });
const post = (path, body) => request(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });

export { API_BASE, ApiError, get, post };
