import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built assets resolve correctly whether this is
  // served from a GitHub Pages project site (username.github.io/repo-name/)
  // or from the root of a domain. Safe here because the app has no
  // client-side router.
  base: './',
  plugins: [react()],
  // No dev-server proxy anymore: the frontend now talks to the backend
  // over a real absolute URL (VITE_API_BASE, see .env) with the backend's
  // own CORS allowlist (see backend/src/app.js) rather than opaque
  // same-origin proxying. Set VITE_API_BASE to wherever `npm run dev` in
  // backend/ is listening.
})
