# F1 Dashboard

A web dashboard for Formula 1: championship standings, race calendar, driver & team profiles, and past-race telemetry.

## Tech

- **client/** — React + Vite + TypeScript
- **server/** — Node + Express + TypeScript (proxies & caches public F1 APIs)

Data comes from [Jolpica-F1](https://github.com/jolpica/jolpica-f1) (standings, schedule, results) and [OpenF1](https://openf1.org/) (telemetry). Both are free and need no API key.

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
