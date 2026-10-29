# 🏎️ Paddock Times

A full-stack Formula 1 statistics web app: championship standings, race calendar,
driver & team profiles, head-to-head comparisons, past-race telemetry, and a
**session replay player** that plays back completed races lap-by-lap.

**Live:** https://f1-dashboard-bryzhak.onrender.com

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)

---

## Overview

Paddock Times is a monorepo with a **React SPA** and an **Express API**. The client
only ever talks to our own backend; the backend fetches data from free public F1
sources, normalizes their verbose shapes into flat types, and caches everything in
memory. One deployed web service serves both the API (`/api/*`) and the built SPA.

The project covers 1950 → present for historical stats, and 2023 → present for
telemetry and replays.

---

## ✨ Features

### Core stats
- **Standings** — drivers' and constructors' championships for any season (1950–now),
  plus a title-race progression chart.
- **Race calendar & results** — every round of a season, with winners; **sprint
  weekends are flagged**, and each race-weekend page shows the full result,
  qualifying, **sprint results**, grid → finish deltas, fastest lap and Driver of
  the Day.
- **Driver & team profiles** — full career totals (championships, wins, podiums,
  points, races) plus a season-by-season breakdown, with a data-driven prose summary.
- **Driver & team search** — filter every driver/constructor since 1950 by name,
  nationality and era.
- **Head-to-head comparison** — compare two drivers across their careers, including
  their race-by-race record in events they both contested.

### Live & replay
- **Session replay player** — load any completed race or **sprint** (2023+) and play
  it back on a live-timing-style board: play/pause, speed control (5×–60×), and a
  scrubbable timeline.
  - Sector-by-sector reveal with baked timing colours (purple/green/yellow).
  - Position-change arrows (🟢 gained / 🔴 lost) with a fading row highlight.
  - Track-status banner (green / yellow / SC / VSC / red / chequered) and an **IN
    PIT** badge.
  - Click any driver — or **several at once** — to expand per-lap sector detail,
    mini-sectors, speeds and tyre stints for side-by-side comparison.
- **Live timing** — a real-time board during sessions. OpenF1 locks its entire API
  (401) during live sessions on the free tier, so the app degrades gracefully to a
  "locked" banner instead of hanging.

### Media (copyright-aware)
- **Driver photos** from Wikimedia Commons, matched by name via the MediaWiki
  `pageimages` API (CC-BY-SA / public domain).
- **Team logos & photos** resolved through Wikidata (logo `P154`, image `P18`) and
  **licence-checked on Commons** — a free PD/CC logo is used when available,
  otherwise a free car photo, otherwise a team-coloured tile. Trademarked / non-free
  emblems are deliberately skipped.

### Platform
- **SEO** — per-route titles/meta/Open Graph/canonical, JSON-LD structured data,
  breadcrumbs, cross-links, season-in-URL routes, a 147-URL sitemap and `robots.txt`.
- **Home page** — dynamic weekend highlights (winner, podium, notable retirement,
  championship leader, next race) derived from our own data, plus live news headlines
  from an RSS feed.
- **Feedback form** for user suggestions and bug reports.
- **Google Analytics 4**, a toggleable cookie-consent banner, and a full footer with
  data attributions and disclaimers.

---

## 🧱 Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, React Router 6, Recharts |
| Backend | Node 20, Express 4, TypeScript, Helmet, node-cache |
| Data | [f1db](https://github.com/f1db/f1db) (CC-BY 4.0), [OpenF1](https://openf1.org/), Wikimedia Commons / Wikidata |
| Hosting | Render (single web service) |

---

## 🗂️ Data sources

- **[f1db](https://github.com/f1db/f1db)** (CC-BY 4.0) — standings, results, schedule,
  drivers, constructors; 1950 → present. Distributed as **downloadable release
  artifacts, not a live API**, so there is nothing to rate-limit or time out. The
  server downloads the latest `f1db-json-splitted.zip` once, unzips it in memory
  (`adm-zip`), and joins the normalized tables into our flat types. The dataset is
  held in a single in-flight promise for the process lifetime.
- **[OpenF1](https://openf1.org/)** — telemetry, laps, sectors, stints, race control;
  2023 → present. Used for live timing and session replays.
- **Wikimedia Commons / Wikidata** — driver photos and (licence-checked) team imagery.

---

## 🏛️ Architecture

```
┌────────────┐     /api/*      ┌──────────────┐   HTTP    ┌──────────────────┐
│ React SPA  │ ──────────────▶ │  Express API │ ────────▶ │ f1db · OpenF1 ·  │
│ (Vite)     │ ◀────────────── │  normalize + │ ◀──────── │ Wikimedia · RSS  │
└────────────┘   flat JSON     │  cache (TTL) │           └──────────────────┘
                               └──────────────┘
```

- The **client only talks to our backend** (`/api/*`). In dev, Vite proxies `/api`
  to the server; in production, Express serves both the API and the built SPA.
- Every upstream call is wrapped in `cached(key, ttlSeconds, producer)` (in-memory
  TTL cache) to stay well within rate limits.
- A single error handler turns thrown errors into `502 { error }`.

### Project structure

```
F1_Dashboard/
├── client/                 # React + Vite SPA
│   ├── src/
│   │   ├── pages/           # route components (Home, Standings, Live, …)
│   │   ├── components/      # shared UI (ReplayPlayer, EntityCards, Footer, …)
│   │   ├── hooks/           # useAsync, useSeo, useSeasonRoute
│   │   ├── lib/             # f1 metadata, team colours, JSON-LD helpers
│   │   ├── api/client.ts    # typed wrapper around /api
│   │   └── types/f1.ts      # client-side mirror of the backend types
│   └── public/              # sitemap.xml, robots.txt, icons
└── server/                  # Node + Express API
    └── src/
        ├── routes/          # thin Express handlers (standings, live, …)
        ├── services/        # fetch + normalize + cache (f1db, live, teamImages, …)
        ├── cache/           # node-cache TTL wrapper
        └── types/f1.ts      # canonical normalized types
```

---

## 🔌 API

All endpoints are prefixed with `/api`.

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness probe |
| `GET /home` | Weekend highlights + news headlines |
| `GET /standings/drivers/:season` | Driver championship for a season |
| `GET /standings/constructors/:season` | Constructor championship for a season |
| `GET /standings/progression/:season` | Title-race progression (chart data) |
| `GET /calendar/:season` | Season schedule + winners (sprint-flagged) |
| `GET /calendar/:season/:round` | A single race result |
| `GET /calendar/:season/:round/weekend` | Full weekend: race, qualifying, sprint, highlights |
| `GET /drivers` · `GET /drivers/:id` | Driver list / full profile |
| `GET /drivers/photos` | Driver photos (Wikimedia), keyed by id |
| `GET /constructors` · `GET /constructors/:id` | Constructor list / full profile |
| `GET /constructors/images` | Licence-checked team logos/photos |
| `GET /compare/drivers/:a/:b` | Head-to-head comparison |
| `GET /telemetry/sessions/:season` · `/telemetry/drivers/:sessionKey` | Telemetry metadata |
| `GET /live/status` | Live-session status (handles OpenF1 lock) |
| `GET /live/races` | Replayable races **and sprints** (2023+) |
| `GET /live/:sessionKey/replay` · `/board` · `/driver/:num` | Replay / board / driver detail |
| `POST /feedback` | Submit user feedback |

---

## 🚀 Getting started

Requires **Node 18+** (Node 20 recommended).

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

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend.

### Scripts

**client:** `npm run dev` · `npm run build` (type-check + production build) · `npm run lint`
**server:** `npm run dev` (ts-node-dev reload) · `npm run build` (`tsc`) · `npm start`

### Environment variables (server)

| Variable | Purpose |
|---|---|
| `PORT` | API port (default 3001) |

---

## 🌐 Deployment & operations

- Deployed on **Render** as a single web service that builds both packages and serves
  the API together with the built SPA.
- **Keep-alive:** Render's free tier spins the service down after ~15 min of
  inactivity (a 30–60 s cold start on the next request). An external cron pinger hits
  `/api/home` every 10 minutes, which both keeps the process awake and keeps the f1db
  dataset warm in memory. (A sleeping server returning errors on `robots.txt` can also
  stall Googlebot, so the keep-alive doubles as an SEO safeguard.)

---

## 📝 Credits & licence

- Formula 1 data: **f1db** (CC-BY 4.0) and **OpenF1**.
- Driver photos and team logos/photos: **Wikimedia Commons** (CC-BY-SA / public
  domain, by their respective authors).
- F1, FORMULA 1 and related marks are trademarks of Formula One Licensing B.V. This
  is an unofficial, non-commercial fan project and is not associated with Formula 1.

---

<br>

# 🇺🇦 Українська версія

# 🏎️ Paddock Times

Повноцінний веб-застосунок зі статистикою Формули-1: турнірні таблиці чемпіонату,
календар гонок, профілі пілотів і команд, порівняння «голова-в-голову», телеметрія
минулих гонок і **плеєр реплеїв сесій**, що відтворює завершені гонки коло за колом.

**Онлайн:** https://f1-dashboard-bryzhak.onrender.com

---

## Огляд

Paddock Times — це монорепозиторій із **React SPA** та **Express API**. Клієнт
спілкується виключно з нашим бекендом; бекенд отримує дані з безкоштовних публічних
джерел F1, нормалізує їхні громіздкі формати у плоскі типи й кешує все в пам'яті. Один
розгорнутий веб-сервіс віддає і API (`/api/*`), і зібраний SPA.

Проєкт охоплює історичну статистику від 1950 до сьогодні, а телеметрію й реплеї —
від 2023 до сьогодні.

---

## ✨ Можливості

### Основна статистика
- **Турнірні таблиці** — чемпіонати пілотів і конструкторів за будь-який сезон
  (1950–тепер), плюс графік перебігу боротьби за титул.
- **Календар і результати гонок** — кожен етап сезону з переможцями; **спринт-вікенди
  позначаються**, а сторінка кожного гоночного вікенду показує повний результат,
  кваліфікацію, **результати спринту**, різницю старт → фініш, найшвидше коло та
  Пілота дня.
- **Профілі пілотів і команд** — повні кар'єрні підсумки (чемпіонства, перемоги,
  подіуми, очки, гонки) та розбивка по сезонах із текстовим описом на основі даних.
- **Пошук пілотів і команд** — фільтрація кожного пілота/конструктора від 1950 за
  іменем, національністю та епохою.
- **Порівняння «голова-в-голову»** — порівняння двох пілотів за кар'єрами, включно з
  їхнім результатом у гонках, де вони виступали разом.

### Live та реплеї
- **Плеєр реплеїв сесій** — завантаж будь-яку завершену гонку чи **спринт** (2023+) і
  відтвори її на табло в стилі live-timing: play/pause, керування швидкістю (5×–60×)
  та таймлайн із перемотуванням.
  - Посекторне проявлення з кольорами таймінгу (фіолетовий/зелений/жовтий).
  - Стрілки зміни позицій (🟢 набрав / 🔴 втратив) із підсвіткою рядка, що згасає.
  - Плашка статусу траси (зелений / жовтий / SC / VSC / червоний / картатий) і значок
    **IN PIT**.
  - Клік по гонщику — або по **кількох одночасно** — розгортає посекторні деталі кола,
    мінісектори, швидкості та відрізки на шинах для порівняння поруч.
- **Live timing** — табло в реальному часі під час сесій. OpenF1 на безкоштовному
  тарифі блокує весь свій API (401) під час живих сесій, тож застосунок коректно
  переходить у стан «заблоковано» замість зависання.

### Медіа (з урахуванням авторського права)
- **Фото пілотів** із Wikimedia Commons, зіставлені за іменем через MediaWiki
  `pageimages` API (CC-BY-SA / суспільне надбання).
- **Логотипи й фото команд** визначаються через Wikidata (логотип `P154`, зображення
  `P18`) із **перевіркою ліцензії на Commons** — вільний PD/CC логотип, якщо є, інакше
  вільне фото боліда, інакше плитка в кольорі команди. Торгові марки / невільні
  емблеми свідомо пропускаються.

### Платформа
- **SEO** — на кожен маршрут свої title/meta/Open Graph/canonical, структуровані дані
  JSON-LD, «хлібні крихти», перехресні посилання, сезон у URL, sitemap на 147 URL і
  `robots.txt`.
- **Головна сторінка** — динамічні підсумки вікенду (переможець, подіум, помітний сход,
  лідер чемпіонату, наступна гонка) на основі власних даних, плюс живі новинні
  заголовки з RSS-стрічки.
- **Форма зворотного зв'язку** для пропозицій і повідомлень про помилки.
- **Google Analytics 4**, перемикувана плашка згоди на cookie та повний футер з
  атрибуцією даних і дисклеймерами.

---

## 🧱 Технології

| Рівень | Стек |
|---|---|
| Фронтенд | React 18, TypeScript, Vite 5, React Router 6, Recharts |
| Бекенд | Node 20, Express 4, TypeScript, Helmet, node-cache |
| Дані | [f1db](https://github.com/f1db/f1db) (CC-BY 4.0), [OpenF1](https://openf1.org/), Wikimedia Commons / Wikidata |
| Хостинг | Render (один веб-сервіс) |

---

## 🗂️ Джерела даних

- **[f1db](https://github.com/f1db/f1db)** (CC-BY 4.0) — таблиці, результати, календар,
  пілоти, конструктори; 1950 → тепер. Розповсюджується як **завантажувані файли
  релізів, а не живий API**, тож немає чого обмежувати за частотою чи що могло б упасти.
  Сервер один раз завантажує найсвіжіший `f1db-json-splitted.zip`, розпаковує його в
  пам'яті (`adm-zip`) і зшиває нормалізовані таблиці у наші плоскі типи. Датасет
  тримається в єдиному проміжному промісі на весь час життя процесу.
- **[OpenF1](https://openf1.org/)** — телеметрія, кола, сектори, відрізки на шинах,
  race control; 2023 → тепер. Використовується для live timing і реплеїв сесій.
- **Wikimedia Commons / Wikidata** — фото пілотів і (перевірені за ліцензією)
  зображення команд.

---

## 🏛️ Архітектура

```
┌────────────┐     /api/*      ┌──────────────┐   HTTP    ┌──────────────────┐
│ React SPA  │ ──────────────▶ │  Express API │ ────────▶ │ f1db · OpenF1 ·  │
│ (Vite)     │ ◀────────────── │ нормалізація │ ◀──────── │ Wikimedia · RSS  │
└────────────┘   плоский JSON  │ + кеш (TTL)  │           └──────────────────┘
                               └──────────────┘
```

- **Клієнт говорить лише з нашим бекендом** (`/api/*`). У розробці Vite проксує `/api`
  на сервер; у продакшені Express віддає і API, і зібраний SPA.
- Кожен зовнішній виклик обгорнуто в `cached(key, ttlSeconds, producer)` (кеш у
  пам'яті з TTL), щоб упевнено лишатися в межах лімітів.
- Єдиний обробник помилок перетворює винятки на `502 { error }`.

### Структура проєкту

```
F1_Dashboard/
├── client/                 # React + Vite SPA
│   ├── src/
│   │   ├── pages/           # компоненти маршрутів (Home, Standings, Live, …)
│   │   ├── components/      # спільний UI (ReplayPlayer, EntityCards, Footer, …)
│   │   ├── hooks/           # useAsync, useSeo, useSeasonRoute
│   │   ├── lib/             # метадані F1, кольори команд, хелпери JSON-LD
│   │   ├── api/client.ts    # типізована обгортка над /api
│   │   └── types/f1.ts      # клієнтська копія бекенд-типів
│   └── public/              # sitemap.xml, robots.txt, іконки
└── server/                  # Node + Express API
    └── src/
        ├── routes/          # тонкі Express-хендлери (standings, live, …)
        ├── services/        # fetch + нормалізація + кеш (f1db, live, teamImages, …)
        ├── cache/           # обгортка node-cache з TTL
        └── types/f1.ts      # канонічні нормалізовані типи
```

---

## 🔌 API

Усі ендпоінти мають префікс `/api`.

| Ендпоінт | Опис |
|---|---|
| `GET /health` | Перевірка доступності |
| `GET /home` | Підсумки вікенду + новинні заголовки |
| `GET /standings/drivers/:season` | Чемпіонат пілотів за сезон |
| `GET /standings/constructors/:season` | Чемпіонат конструкторів за сезон |
| `GET /standings/progression/:season` | Перебіг боротьби за титул (дані графіка) |
| `GET /calendar/:season` | Календар сезону + переможці (з позначкою спринтів) |
| `GET /calendar/:season/:round` | Результат однієї гонки |
| `GET /calendar/:season/:round/weekend` | Увесь вікенд: гонка, кваліфікація, спринт, хайлайти |
| `GET /drivers` · `GET /drivers/:id` | Список / повний профіль пілота |
| `GET /drivers/photos` | Фото пілотів (Wikimedia), за id |
| `GET /constructors` · `GET /constructors/:id` | Список / повний профіль конструктора |
| `GET /constructors/images` | Логотипи/фото команд із перевіркою ліцензії |
| `GET /compare/drivers/:a/:b` | Порівняння «голова-в-голову» |
| `GET /telemetry/sessions/:season` · `/telemetry/drivers/:sessionKey` | Метадані телеметрії |
| `GET /live/status` | Статус живої сесії (з обробкою блокування OpenF1) |
| `GET /live/races` | Гонки **та спринти** для реплею (2023+) |
| `GET /live/:sessionKey/replay` · `/board` · `/driver/:num` | Реплей / табло / деталі пілота |
| `POST /feedback` | Надсилання зворотного зв'язку |

---

## 🚀 Запуск

Потрібен **Node 18+** (рекомендовано Node 20).

```bash
# Термінал 1 — бекенд (http://localhost:3001)
cd server
npm install
npm run dev

# Термінал 2 — фронтенд (http://localhost:5173)
cd client
npm install
npm run dev
```

Відкрий http://localhost:5173 — Vite проксує `/api` на бекенд.

### Скрипти

**client:** `npm run dev` · `npm run build` (перевірка типів + продакшн-збірка) · `npm run lint`
**server:** `npm run dev` (ts-node-dev з перезавантаженням) · `npm run build` (`tsc`) · `npm start`

### Змінні середовища (сервер)

| Змінна | Призначення |
|---|---|
| `PORT` | Порт API (за замовчуванням 3001) |

---

## 🌐 Розгортання та експлуатація

- Розгорнуто на **Render** як єдиний веб-сервіс, що збирає обидва пакети й віддає API
  разом із зібраним SPA.
- **Keep-alive:** безкоштовний тариф Render присипляє сервіс після ~15 хв простою
  (холодний старт 30–60 с на наступний запит). Зовнішній cron-пінгер звертається до
  `/api/home` кожні 10 хвилин, що і тримає процес активним, і зберігає датасет f1db
  теплим у пам'яті. (Сплячий сервер, який віддає помилки на `robots.txt`, також може
  застопорити Googlebot, тож keep-alive слугує ще й запобіжником для SEO.)

---

## 📝 Подяки та ліцензія

- Дані Формули-1: **f1db** (CC-BY 4.0) та **OpenF1**.
- Фото пілотів і логотипи/фото команд: **Wikimedia Commons** (CC-BY-SA / суспільне
  надбання, авторства відповідних авторів).
- F1, FORMULA 1 та пов'язані марки є торговими марками Formula One Licensing B.V. Це
  неофіційний некомерційний фанатський проєкт, не пов'язаний із Formula 1.

---

<sub>Built incrementally — standings, calendar, profiles, telemetry, F1.com-inspired
design, live timing, session replays, search, media, and SEO.</sub>
