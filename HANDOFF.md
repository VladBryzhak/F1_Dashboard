# HANDOFF — F1 Dashboard

Останнє оновлення: 2026-07-07

## Поточна мета

Ітеративне покращення F1 Dashboard (React/Vite клієнт + Express сервер, дані з f1db та OpenF1). У цій сесії фокус був на:
1. Налаштуванні локального dev-оточення (Node.js, GitHub SSH).
2. Додаванні колонки "Gap" (відставання від лідера) у Standings.
3. Виправленні історичної точності фото пілотів/боліда — щоб пілот показувався у формі **тієї команди, за яку він реально виступав у вибраному сезоні** (наприклад, Хемілтон — Mercedes у 2024, Ferrari у 2025+).

## Ключові рішення

### 1. Середовище розробки
- На машині не було Node.js/npm/Homebrew — встановлено **nvm** (`~/.nvm`) → **Node 20.20.2**.
- GitHub підключено через **SSH** (не HTTPS/token) — ключ згенеровано локально (`~/.ssh/id_ed25519`), публічний ключ доданий у GitHub акаунт власника.
- Репозиторій: `git@github.com:VladBryzhak/F1_Dashboard.git`, локально в `~/Desktop/Сайти/F1_Dashboard`.
- Dev-сервери запускаються через **Claude Preview** (`.claude/launch.json` у корені `Сайти/`, НЕ в `F1_Dashboard/`), бо MCP-тул шукає launch.json відносно робочої директорії сесії, а не репозиторію.
  - Через nvm команда `npm` не в PATH дочірніх процесів (vite/ts-node-dev), тому в launch.json прописані **абсолютні шляхи** до `node` + `npm-cli.js` і явний `env.PATH`, що включає nvm-bin директорію. Якщо Node оновиться через nvm, ці шляхи в `Сайти/.claude/launch.json` треба буде оновити на нову версію.

### 2. Сезон боліда/фото — динамічний, не фіксований
Спершу було зроблено фіксацію (боліди завжди 2026, фото пілотів завжди 2025), але користувач попросив повернути **динамічну прив'язку до сезону, обраного в дропдауні** на кожній сторінці (Standings/Drivers/Teams). Це поточний робочий стан.

### 3. Історично точні фото пілотів (нова функція)
**Проблема:** OpenF1 API (`GET /drivers?session_key=...`) повертає `headshot_url`, який **статичний і не змінюється по сезонах** — Хемілтон завжди повертає те саме фото (актуальне на команду), незалежно від того, який сезон запитується. Перевірено прямими запитами до OpenF1 для 2023/2024/2025 — URL ідентичний.

**Рішення:** знайдено інший офіційний CDN formula1.com з рендерами пілота в формі команди **конкретного сезону**:
```
https://media.formula1.com/image/upload/c_lfill,w_600/q_auto/v1740000001/common/f1/{season}/{teamSlug}/{driverSlug}/{season}{teamSlug}{driverSlug}right.webp
```
Приклад (Хемілтон, Mercedes, 2024): підтверджено робочий; той самий пілот у 2025 з `ferrari` замість `mercedes` — теж робочий.

**Обмеження CDN (важливо!):** ретельно протестовано (десятки комбінацій команда/пілот/рік/сторона left-right) — **рендери є ТІЛЬКИ для сезонів 2024, 2025, 2026**. Для 2016–2023 CDN повертає 404 для будь-якої комбінації (перевірено Verstappen/RedBull, Hamilton/Mercedes, Leclerc/Ferrari, Alonso/Renault, Vettel/AstonMartin-Ferrari, обидві сторони кадру). Це не помилка мапи слагів — джерела просто не існує для старих сезонів. Те саме стосується рендерів боліда (той самий CDN, той самий шаблон без `{driverSlug}`).

**Реалізація:**
- `client/src/lib/f1meta.ts`:
  - `DRIVER_SLUG: Record<string, string>` — f1db `driverId` → слаг formula1.com (напр. `max-verstappen` → `maxver01`). Заповнено для 28 пілотів грід 2023–2026 (сформовано патерном "перші 3 літери імені + перші 3 літери прізвища + `01`", з ручним виправленням для Antonelli → `andant01` — використовує повне ім'я "Andrea", не "Kimi").
  - `TEAM_CAR_SLUG` розширено: додано `rb: 'rb'`, `'kick-sauber': 'kicksauber'` (потрібні для побудови URL пілотів цих команд).
  - `DRIVER_PORTRAIT_MIN_SEASON = 2024` — жорстке обмеження, нижче якого функція одразу повертає `null`.
  - `driverPortraitUrl(driverId, constructorId, season): string | null` — головна функція, повертає URL або `null`, якщо сезон <2024 або пілот/команда не в мапі.
- Каскадний фолбек зображення (у двох місцях): **офіційний портрет сезону → OpenF1 headshot → кольоровий чіп з кодом пілота**. Реалізовано через `useState<number>` (індекс поточного кандидата в масиві) + `useEffect`, що скидає індекс на 0 при зміні списку кандидатів (зміна сезону/пілота), і `onError`, що зсуває індекс на наступний кандидат:
  - `client/src/components/StandingsTable.tsx` → `DriverAvatar` (таблиця standings)
  - `client/src/components/EntityCards.tsx` → `Headshot` (картки на сторінці Drivers)
- Обидва компоненти й батьківські (`DriverStandingsTable`, `DriverCard`) отримали новий обов'язковий проп `season`, який прокинуто зі сторінок `Standings.tsx` / `Drivers.tsx`.

**Приклад ключового коду** (`f1meta.ts`):
```ts
const DRIVER_PORTRAIT_MIN_SEASON = 2024

export function driverPortraitUrl(
  driverId: string,
  constructorId: string,
  season: string,
): string | null {
  if (Number(season) < DRIVER_PORTRAIT_MIN_SEASON) return null
  const driverSlug = DRIVER_SLUG[driverId]
  const teamSlug = TEAM_CAR_SLUG[constructorId]
  if (!driverSlug || !teamSlug) return null
  return (
    `https://media.formula1.com/image/upload/c_lfill,w_600/q_auto/` +
    `v1740000001/common/f1/${season}/${teamSlug}/${driverSlug}/${season}${teamSlug}${driverSlug}right.webp`
  )
}
```

Каскадний фолбек (спрощено, `StandingsTable.tsx`):
```tsx
const candidates = [portraitUrl, fallbackUrl].filter((u): u is string => !!u)
const key = candidates.join('|')
const [idx, setIdx] = useState(0)
useEffect(() => setIdx(0), [key])
const src = candidates[idx]
// <img src={src} onError={() => setIdx((i) => i + 1)} /> або fallback-чіп, якщо candidates порожній
```

### 4. Колонка "Gap" у Standings
Додано в обидві таблиці (`DriverStandingsTable`, `ConstructorStandingsTable` у `StandingsTable.tsx`). Рахується на клієнті (rows вже відсортовані за позицією):
```ts
const leaderPoints = rows[0]?.points ?? 0
// на рядок:
const gap = leaderPoints - r.points
// рендер: {gap > 0 ? `-${gap}` : '—'}
```
Ніяких змін на сервері/в типах API не знадобилось — суто клієнтський розрахунок.

## Статус задач

| Задача | Статус |
|---|---|
| Встановити Node.js/npm через nvm | ✅ Готово |
| Підключити GitHub через SSH, клонувати репозиторій | ✅ Готово |
| Налаштувати `.claude/launch.json` для client+server | ✅ Готово |
| Колонка "Gap" у Standings (drivers + constructors) | ✅ Готово, перевірено в браузері |
| Динамічний сезон для боліда/фото (не фіксований) | ✅ Готово |
| Історично точні фото пілотів у формі сезону (2024–2026) | ✅ Готово, перевірено в браузері (Hamilton 2024 Mercedes / 2025 Ferrari) |
| Прибрати мертвий код (`Placeholder.tsx`, `App.css`) | ⏳ Запропоновано, **не виконано** (користувач ще не підтвердив) |
| Прибрати зайву залежність `"f1-dashboard": "file:.."` з package.json | ⏳ Запропоновано, **не виконано** |
| Оновити застарілу секцію CLAUDE.md (Windows/Avast) | ⏳ Запропоновано, **не виконано** |
| Оновити застарілий коментар "Jolpica" в `server/src/cache/cache.ts` | ⏳ Запропоновано, **не виконано** |
| Уточнити статус M3 (driver/team profiles) у README | ⏳ Відкрите питання до користувача |
| Фото пілотів для сезонів до 2024 (2016–2023) у формі тодішньої команди | ❌ **Заблоковано** — дивись нижче |

## Що заблоковано

**Історичні фото пілотів (2016–2023) у формі команди того часу — неможливо через відсутність джерела.**
- OpenF1 headshot: статичний, не сезонний.
- formula1.com CDN (`common/f1/{season}/...`): підтверджено (десятки протестованих комбінацій), що дані є **тільки з 2024 року**. До 2023 включно — 404 для всіх перевірених пар пілот/команда/рік.
- Наразі для сезонів <2024 показується OpenF1-фолбек (може не відповідати команді сезону).
- Альтернативи не досліджені: інше стороннє джерело зображень існує теоретично, але точність/ліцензійність під питанням — потребує окремого рішення користувача, чи варто це досліджувати.

## Важливі нюанси середовища (для наступної сесії)

- Node встановлено через nvm, **не** system-wide. Абсолютний шлях зашитий у `Сайти/.claude/launch.json` (`/Users/vladyslavbryzhak/.nvm/versions/node/v20.20.2/...`) — якщо Node оновиться, шляхи там протухнуть і preview-сервери перестануть стартувати з помилкою `No such file or directory`.
- `.claude/launch.json` існує у ДВОХ місцях:
  - `Сайти/.claude/launch.json` — той, що реально використовує `preview_start` (з абсолютними шляхами node/npm-cli.js та `env.PATH`).
  - `F1_Dashboard/.claude/launch.json` — старий/початковий, спрощений (`npm run dev`), закомічений у репозиторій, **не той, що використовується** зараз Claude Preview-тулом.
- Обидва dev-сервери (`server` :3001, `client` :5173) на момент завершення сесії запущені й робочі.
