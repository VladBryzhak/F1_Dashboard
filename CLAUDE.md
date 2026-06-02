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

- **f1db** (`https://github.com/f1db/f1db`, CC-BY 4.0) — standings, results, drivers, constructors, schedule; 1950→present. Distributed as **downloadable release artifacts, not a live API**, so there is nothing to rate-limit or time out. `server/src/services/f1db.ts` downloads the latest `f1db-json-splitted.zip` once, unzips it in memory (adm-zip), and joins the normalized tables into our flat shapes. The dataset is held in a single in-flight promise for the process lifetime — **restart the server to pick up a newer f1db release**. f1db ids are kebab-case (`max-verstappen`, `red-bull`); team colours in `client/src/lib/f1meta.ts` are keyed by these constructorIds.
  - Note: f1db season standings don't carry the driver's team or win count, so the service joins `seasons-entrants-drivers` (team per season, most-rounds wins) and counts P1 finishes in `races-race-results` (wins). Nationality demonym/flag comes from `countries.json`.
  - We previously used Jolpica-F1; it was dropped (unreliable, frequent outages) in favour of f1db.
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
