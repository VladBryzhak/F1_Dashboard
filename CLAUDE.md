# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

F1 Dashboard — a web app showing Formula 1 standings, race calendar, driver/team profiles, and past-race telemetry. Monorepo with a React frontend and an Express backend that proxies and caches public F1 APIs.

## Layout

- `client/` — React 18 + Vite 5 + TypeScript. React Router for pages.
- `server/` — Node + Express + TypeScript. Fetches/normalizes/caches F1 data.

The **client only talks to our backend** (`/api/*`). The **server** talks to the upstream F1 APIs, normalizes their verbose shapes into the flat types in `server/src/types/f1.ts` (mirrored in `client/src/types/f1.ts`), and caches responses.

## Styles (client)

Plain CSS, split by area (no CSS-in-JS, no CSS Modules):

- `design.md` (repo root) — the locked design system (Hallmark, Console material, brand kept): meanings of the colours, type and surfaces. `client/src/styles/tokens.css` — every colour, the mono face, spacing and type scale as tokens (older names like `--bg`/`--accent` alias them). `client/src/styles/base.css` — fonts and element defaults; `styles/shared.css` — building blocks used by several pages (page frame, cards and `table.standings`, tabs, tyre badges, banners, detail-page title/highlight tiles). All three are imported first in `main.tsx` (tokens, base, shared). New or redesigned styles use the tokens only: no colour or font literals.
- Every page/component that owns styles imports its own file next to it (`pages/Home.tsx` → `./Home.css`, `components/ReplayPlayer.tsx` → `./ReplayPlayer.css`). Driver + team profiles share `styles/profile.css`; About/Privacy share `pages/Doc.css`; driver/team search share `components/EntitySearch.css`.
- Vite splits page CSS into the lazy route chunks, so it only loads with its page — but once loaded it stays in the document. Therefore: a class that is used by more than one page goes in `shared.css`; page files only hold classes unique to that page (prefixes like `circ-`, `sched-`, `rp-`, `cmp-`, `strat-`). Keep each `@media` rule in the same file, right after the rules it adjusts.

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

- **f1db** (`https://github.com/f1db/f1db`, CC-BY 4.0) — standings, results, drivers, constructors, schedule; 1950→present. Distributed as **downloadable release artifacts, not a live API**, so there is nothing to rate-limit or time out. `server/src/services/f1db.ts` downloads the latest `f1db-json-splitted.zip` once, unzips it in memory (adm-zip), and joins the normalized tables into our flat shapes. The dataset is held in memory; every 30 min (`F1DB_CHECK_MS`) the server asks GitHub which tag the latest release points to (a redirect, no API quota) and, when it changed, downloads that release in the background, swaps it in and drops dataset-derived caches (`sitemap:`, `story:`). Results therefore appear without a restart, usually the morning after a race when f1db publishes. f1db ids are kebab-case (`max-verstappen`, `red-bull`); team colours in `client/src/lib/f1meta.ts` are keyed by these constructorIds.
  - Note: f1db season standings don't carry the driver's team or win count, so the service joins `seasons-entrants-drivers` (team per season, most-rounds wins) and counts P1 finishes in `races-race-results` (wins). Nationality demonym/flag comes from `countries.json`.
  - We previously used Jolpica-F1; it was dropped (unreliable, frequent outages) in favour of f1db.
- **OpenF1** (`https://api.openf1.org/v1`) — telemetry (speed/throttle/brake/DRS/gear), laps, sectors. Historical data free from 2023 onward. Used for the Telemetry feature (`server/src/services/openf1.ts`, M4).

## Generated data (server/src/data)

Committed JSON built by one-off scripts, so the site makes no extra upstream calls at runtime. Re-run when a new circuit joins the calendar:

- `circuit-outlines.json` ← `node server/scripts/build-circuit-outlines.mjs` — SVG outlines from the open f1-circuits GeoJSON (MIT), keyed by f1db circuitId.
- `track-lines.json` ← `node server/scripts/build-track-lines.mjs` — replay track map: one reference lap (racing line + per-point timing) and one pit stop (pit-lane path, offset from OpenF1's pit `date`) per OpenF1 circuit_key. The client positions cars from lap/sector/pit/position timing along it (`client/src/lib/trackModel.ts`).

## Link previews (Open Graph)

Social crawlers don't run JS, so the Express SPA fallback (`server/src/services/pageHtml.ts`) fills each page's `<title>`, description, canonical and OG/Twitter tags from `describePage()` in `server/src/services/og.ts`, which also draws the 1200×630 preview served at `/og/<page path>.png` (SVG → PNG with `@resvg/resvg-js`, Saira Condensed from `server/assets/fonts`, OFL). Keep its titles/descriptions in step with the pages' `useSeo` calls. On a cold start people get the page at once with default tags; crawlers wait for the dataset.

## Search engines (snapshot + sitemap)

- Crawlers (the `BOT` user-agent pattern in `server/src/services/pageHtml.ts`) get a plain-HTML snapshot of the page inside `#root`: heading, a sentence or two, the key data and links to related pages (`services/snapshot.ts`, built from the same dataset). People get the empty root and the app (`createRoot` replaces the snapshot for crawlers that run JS). The response sends `Vary: User-Agent`.
- `/sitemap.xml` is generated from the dataset (`services/sitemap.ts`, cached 6 h): static sections, standings and calendars of recent seasons, race pages of the current and previous season, drivers and teams of the last three grids plus every champion, and circuits. There is no static `client/public/sitemap.xml`. Add `/support` to `STATIC_PAGES` once the donation link is real.

## Page speed (home page)

- `pageHtml()` inlines the main stylesheet into the HTML and, for `/`, inlines the home data (`window.__HOME__`, built by `services/home.ts`, same payload as `/api/home`) plus a `<link rel="preload">` for the hero photo (`imagesrcset`/`imagesizes` from the payload's `heroSrcSet`/`heroSizes`, which the `<img>` uses too — keep `HERO_SIZES` in `services/home.ts` in step with the `.hm-portrait img` size in `Home.css`). The hero URL comes from `services/portraits.ts`, a mirror of `driverPortraitUrl()` in `client/src/lib/f1meta.ts` — keep the slug maps in step.
- Home is imported eagerly in `App.tsx` (no chunk round trip on the landing page).
- Fonts are self-hosted in `client/public/fonts` (Saira, OFL) and loaded by a non-blocking `fonts.css`; gtag.js loads after the page's `load` event, when the browser is idle.

## Server conventions

- Add a feature by writing a `services/*.ts` (fetch + normalize), then a `routes/*.ts` (thin Express handlers that call the service and `next(err)` on failure), then mount it in `src/index.ts`.
- Wrap any upstream call in `cached(key, ttlSeconds, producer)` from `server/src/cache/cache.ts` (in-memory TTL cache) to protect against rate limits.
- A single error handler in `src/index.ts` turns thrown errors into `502 { error: "Service unavailable" }` (details only in the server log). Validate route params that reach OpenF1 or cache keys with `routes/params.ts`. No CORS: the API serves this site only.

## Environment notes (this machine)

This Windows machine runs **Avast antivirus with HTTPS/TLS scanning**, which re-signs all TLS traffic with the "Avast Web/Mail Shield Root" CA. Without trusting that CA, npm and Node `fetch` fail certificate verification.

- npm is configured with `cafile` → `~/.certs/avast-root.pem`.
- `NODE_EXTRA_CA_CERTS` (user env var) also points at that PEM so Node's `fetch` trusts Avast. **Node dev/build/run needs this env var set** or outbound HTTPS to data APIs fails.
- git uses `http.sslVerify=false` for HTTPS; the `origin` remote uses SSH (`git@github.com:VladBryzhak/F1_Dashboard.git`).
- Node is v18, so `create-vite` was pinned to v5 (v7 needs Node 20+). Node 18's global `fetch` *does* honor `NODE_EXTRA_CA_CERTS` (verified).
