# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

F1 Dashboard — a web app showing Formula 1 standings, race calendar, driver/team profiles, and past-race telemetry. Monorepo with a React frontend and an Express backend that proxies and caches public F1 APIs.

## Layout

- `client/` — React 18 + Vite 5 + TypeScript. React Router for pages.
- `server/` — Node + Express + TypeScript. Fetches/normalizes/caches F1 data.

The **client only talks to our backend** (`/api/*`). The **server** talks to the upstream F1 APIs, normalizes their verbose shapes into the flat types in `server/src/types/f1.ts` (mirrored in `client/src/types/f1.ts`), and caches responses.

## Commands

Client (`cd client`):
- `npm run dev` — Vite dev server on http://localhost:5173 (proxies `/api` → `:3001`)
- `npm run build` — type-check + production build
- `npm run lint`

Server (`cd server`):
- `npm run dev` — ts-node-dev with reload on http://localhost:3001
- `npm run build` — `tsc` to `dist/`
- `npm start` — run built server

Run both (two terminals): `server` then `client`. The Vite proxy (`client/vite.config.ts`) forwards `/api` to the server, so no CORS issues in dev.

## Data sources (free, no API key)

- **Jolpica-F1** (`https://api.jolpi.ca/ergast/f1`) — standings, schedule, results, driver/constructor info. Ergast-compatible (Ergast shut down early 2025). Volunteer-run and rate-limited → all responses are cached server-side. Wrapped in `server/src/services/jolpica.ts` with a 12s request timeout (fails fast as a 502 if the API is down).
- **OpenF1** (`https://api.openf1.org/v1`) — telemetry (speed/throttle/brake/DRS/gear), laps, sectors. Historical data free from 2023 onward. Used for the Telemetry feature (`server/src/services/openf1.ts`, M4).

## Server conventions

- Add a feature by writing a `services/*.ts` (fetch + normalize), then a `routes/*.ts` (thin Express handlers that call the service and `next(err)` on failure), then mount it in `src/index.ts`.
- Wrap any upstream call in `cached(key, ttlSeconds, producer)` from `server/src/cache/cache.ts` (in-memory TTL cache) to protect against rate limits.
- A single error handler in `src/index.ts` turns thrown errors into `502 { error }`.

## Environment notes (this machine)

This Windows machine runs **Avast antivirus with HTTPS/TLS scanning**, which re-signs all TLS traffic with the "Avast Web/Mail Shield Root" CA. Without trusting that CA, npm and Node `fetch` fail certificate verification.

- npm is configured with `cafile` → `~/.certs/avast-root.pem`.
- `NODE_EXTRA_CA_CERTS` (user env var) also points at that PEM so Node's `fetch` trusts Avast. **Node dev/build/run needs this env var set** or outbound HTTPS to data APIs fails.
- git uses `http.sslVerify=false` for HTTPS; the `origin` remote uses SSH (`git@github.com:VladBryzhak/F1_Dashboard.git`).
- Node is v18, so `create-vite` was pinned to v5 (v7 needs Node 20+). Node 18's global `fetch` *does* honor `NODE_EXTRA_CA_CERTS` (verified).
