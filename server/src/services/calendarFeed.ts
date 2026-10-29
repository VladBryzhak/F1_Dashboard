import { getCalendar } from "./f1db";

// Subscribable iCalendar feed of the F1 calendar (webcal). Calendar apps poll
// it, so new seasons and time changes arrive without the visitor doing
// anything. Built from the same f1db sessions as the calendar page.

const SITE = "https://f1-dashboard-bryzhak.onrender.com";

export type FeedLang = "en" | "uk";

// Mirrors client/src/lib/gpNames.ts (full Ukrainian titles) — keep in step.
const GP_UK: Record<string, string> = {
  "70th Anniversary": "Гран-прі 70-річчя",
  "Abu Dhabi": "Гран-прі Абу-Дабі",
  Argentina: "Гран-прі Аргентини",
  Australia: "Гран-прі Австралії",
  Austria: "Гран-прі Австрії",
  Azerbaijan: "Гран-прі Азербайджану",
  Bahrain: "Гран-прі Бахрейну",
  "Barcelona-Catalunya": "Гран-прі Барселони-Каталонії",
  Belgium: "Гран-прі Бельгії",
  Brazil: "Гран-прі Бразилії",
  "Caesars Palace": "Гран-прі Цезарс-Пелас",
  Canada: "Гран-прі Канади",
  China: "Гран-прі Китаю",
  Dallas: "Гран-прі Далласа",
  Detroit: "Гран-прі Детройта",
  Eifel: "Гран-прі Айфеля",
  "Emilia Romagna": "Гран-прі Емілії-Романьї",
  Europe: "Гран-прі Європи",
  France: "Гран-прі Франції",
  Germany: "Гран-прі Німеччини",
  "Great Britain": "Гран-прі Великої Британії",
  Hungary: "Гран-прі Угорщини",
  India: "Гран-прі Індії",
  Indianapolis: "Інді-500",
  Italy: "Гран-прі Італії",
  Japan: "Гран-прі Японії",
  Korea: "Гран-прі Кореї",
  "Las Vegas": "Гран-прі Лас-Вегаса",
  Luxembourg: "Гран-прі Люксембургу",
  Malaysia: "Гран-прі Малайзії",
  Mexico: "Гран-прі Мексики",
  Miami: "Гран-прі Маямі",
  Monaco: "Гран-прі Монако",
  Morocco: "Гран-прі Марокко",
  Netherlands: "Гран-прі Нідерландів",
  Pacific: "Гран-прі Тихого океану",
  Pescara: "Гран-прі Пескари",
  Portugal: "Гран-прі Португалії",
  Qatar: "Гран-прі Катару",
  Russia: "Гран-прі Росії",
  Sakhir: "Гран-прі Сахіра",
  "San Marino": "Гран-прі Сан-Марино",
  "Saudi Arabia": "Гран-прі Саудівської Аравії",
  Singapore: "Гран-прі Сінгапуру",
  "South Africa": "Гран-прі Південної Африки",
  Spain: "Гран-прі Іспанії",
  Styria: "Гран-прі Штирії",
  Sweden: "Гран-прі Швеції",
  Switzerland: "Гран-прі Швейцарії",
  "São Paulo": "Гран-прі Сан-Паулу",
  Turkey: "Гран-прі Туреччини",
  Tuscany: "Гран-прі Тоскани",
  "United States": "Гран-прі США",
  "United States West": "Гран-прі Заходу США",
};

const SESSION: Record<FeedLang, Record<string, string>> = {
  en: {
    FP1: "Practice 1",
    FP2: "Practice 2",
    FP3: "Practice 3",
    SQ: "Sprint Qualifying",
    SPRINT: "Sprint",
    Q: "Qualifying",
    RACE: "Race",
  },
  uk: {
    FP1: "Практика 1",
    FP2: "Практика 2",
    FP3: "Практика 3",
    SQ: "Спринт-кваліфікація",
    SPRINT: "Спринт",
    Q: "Кваліфікація",
    RACE: "Гонка",
  },
};

// Same as the client's DURATION_MIN (lib/schedule.ts).
const DURATION_MIN: Record<string, number> = {
  FP1: 60,
  FP2: 60,
  FP3: 60,
  SQ: 45,
  SPRINT: 60,
  Q: 60,
  RACE: 120,
};

function gpTitle(name: string, lang: FeedLang): string {
  if (lang === "uk") return GP_UK[name] ?? `Гран-прі ${name}`;
  return name === "Indianapolis" ? "Indianapolis 500" : `${name} GP`;
}

// "20261025T200000Z"
function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// RFC 5545: lines longer than 75 octets are folded (CRLF + space). Cyrillic
// is 2 bytes per letter in UTF-8, so count bytes, never split a character.
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export async function calendarFeed(lang: FeedLang, racesOnly: boolean): Promise<string> {
  // This year's season and any later one f1db already lists.
  const thisYear = new Date().getUTCFullYear();
  const seasons: string[] = [];
  for (let y = thisYear; y <= thisYear + 1; y++) seasons.push(String(y));
  const calendars = await Promise.all(seasons.map((s) => getCalendar(s)));

  const now = stamp(Date.now());
  const lines: string[] = [];
  for (const cal of calendars) {
    for (const race of cal.races) {
      const title = gpTitle(race.name, lang);
      const where = [race.circuitName, race.placeName].filter(Boolean).join(", ");
      const url = `${SITE}/calendar/${cal.season}/${race.round}`;
      for (const s of race.sessions) {
        if (racesOnly && s.kind !== "RACE") continue;
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${cal.season}-${race.round}-${s.kind}@f1-dashboard-bryzhak.onrender.com`);
        lines.push(`DTSTAMP:${now}`);
        if (s.timeKnown) {
          const start = new Date(s.start).getTime();
          lines.push(`DTSTART:${stamp(start)}`);
          lines.push(`DTEND:${stamp(start + DURATION_MIN[s.kind] * 60_000)}`);
        } else {
          // Time not announced yet: an all-day event on that date.
          const day = s.start.slice(0, 10);
          const next = new Date(`${day}T00:00:00Z`);
          next.setUTCDate(next.getUTCDate() + 1);
          lines.push(`DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`);
          lines.push(`DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
        }
        lines.push(`SUMMARY:${esc(`F1 · ${title} · ${SESSION[lang][s.kind]}`)}`);
        if (where) lines.push(`LOCATION:${esc(where)}`);
        lines.push(`URL:${url}`);
        lines.push(`DESCRIPTION:${esc(url)}`);
        lines.push("END:VEVENT");
      }
    }
  }

  const name =
    lang === "uk"
      ? racesOnly
        ? "Формула-1 · гонки"
        : "Формула-1 · усі сесії"
      : racesOnly
        ? "Formula 1 · races"
        : "Formula 1 · all sessions";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Paddock Times//Season calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-CALDESC:${esc(`Paddock Times · ${SITE}`)}`,
    // How often subscribed apps should re-fetch (a hint; Google decides itself).
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
    ...lines,
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
