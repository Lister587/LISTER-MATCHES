# Deriv Market Analysis Scanner

A real-time analytics dashboard that monitors 19 Deriv volatile index markets simultaneously, scanning for Even/Odd streaks and Matches/Differs entry signals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, serves /api + WebSocket)
- `pnpm --filter @workspace/deriv-scanner run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS (glassmorphic dark theme)
- Backend: Express 5 + `ws` WebSocket library
- No database — pure real-time streaming app

## Where things live

- `artifacts/deriv-scanner/src/` — React frontend
  - `src/hooks/useTickerStream.ts` — WebSocket hook for single symbol
  - `src/hooks/useScannerStream.ts` — WebSocket hook for all 19 symbols
  - `src/lib/digitAnalytics.ts` — pure analytics functions
  - `src/pages/Dashboard.tsx` — main dashboard page
- `artifacts/api-server/src/ws/deriv-proxy.ts` — WebSocket proxy to Deriv API
- `artifacts/api-server/src/index.ts` — HTTP + WebSocket server entry point

## Architecture decisions

- WebSocket proxy: backend connects to `wss://ws.derivws.com/websockets/v3?app_id=1089` and forwards ticks to frontend clients — avoids CORS restrictions on direct browser connections
- Two WS endpoints: `/api/ws/ticker?symbol=X` (single, for active view) and `/api/ws/scanner` (all 19 symbols for the AI scanner)
- All analytics (streaks, frequency distribution, absent digit detection) computed client-side in React
- No database needed — pure streaming analytics, no persistence

## Product

Real-time scanning of 19 Deriv volatile index markets:
- **Even/Odd Tracker**: detects consecutive parity streaks across all markets
- **Absent Digit Engine**: flags digits absent for 20+ ticks (high-probability DIFFERS entry)
- **AI Best Entry Pick**: surfaces the single highest-edge opportunity across all 19 markets
- **Market Analytics View**: last 30 digit chips, giant live digit, 10 SVG frequency rings

## WebSocket Endpoints

- `ws[s]://{host}/api/ws/ticker?symbol=R_10` — single symbol tick stream (raw Deriv passthrough)
- `ws[s]://{host}/api/ws/scanner` — all-symbol normalized scanner stream

## User preferences

- No user accounts, no login, no database — pure analytics tool
- Glassmorphic dark UI: bg-slate-500/10 backdrop-blur-xl border border-white/10
- Amber neon card header glow: shadow-[0_-4px_12px_-2px_rgba(245,158,11,0.15)]

## Gotchas

- The api-server uses `http.createServer(app)` + `WebSocketServer` — not the default `app.listen()` — so WebSocket upgrades work correctly
- WebSocket connections to `/api/ws/*` are routed through the `/api` path in artifact.toml (no separate path entry needed)
- Digit extraction: `parseInt(String(quote).replace('.','').slice(-1))` — must use exactly this formula

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
