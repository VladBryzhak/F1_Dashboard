# F1 Dashboard

A web dashboard for Formula 1: championship standings, race calendar, driver & team profiles, and past-race telemetry.

## Tech

- **client/** — React + Vite + TypeScript
- **server/** — Node + Express + TypeScript (proxies & caches public F1 APIs)

Data comes from [f1db](https://github.com/f1db/f1db) (standings, schedule, results, drivers, constructors — 1950 to now, CC-BY 4.0) and [OpenF1](https://openf1.org/) (telemetry, 2023+). Both are free and need no API key. f1db ships as downloadable data files, so there's no live API to rate-limit or go down.

## Getting started

Requires Node 18+.

```bash
# Terminal 1 — backend (http://localhost:3001)
cd server
npm install
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd client
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend.

## Status

Built incrementally by milestone:

- [x] **M0** — project setup, routing, layout, server caching
- [x] **M1** — championship standings (drivers & constructors, by season)
- [ ] **M2** — race calendar
- [ ] **M3** — driver & team profiles
- [ ] **M4** — telemetry from past races
- [ ] **M5** — visual design pass
