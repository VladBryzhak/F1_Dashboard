import { describe, expect, it } from "vitest";
import { articlePost, postId, previewPost, seasonFresh, seasonPost, sessionPost, signature } from "./telegramChannel";
import type { ArticleSummary, RacePreview, SeasonReview, SessionHero } from "../types/f1";

const row = (position: number, driverName: string, constructorName: string, time: string | null) => ({
  position,
  driverId: null,
  driverName,
  driverCode: null,
  number: null,
  constructorId: null,
  constructorName,
  time,
  laps: null,
});

const hero = (kind: SessionHero["kind"], sessionName: string): SessionHero => ({
  kind,
  sessionName,
  sprint: false,
  segment: null,
  season: 2026,
  round: 20,
  grandPrixName: "São Paulo",
  top: [row(1, "Max Verstappen", "Red Bull", "1:10.123"), row(2, "Lewis Hamilton", "Ferrari", "+0.117"), row(3, "Kimi Antonelli", "Mercedes", "+0.250")],
  endedAt: "2026-11-08T19:00:00.000Z",
});

describe("channel posts", () => {
  it("puts a race's podium, in Ukrainian, with the race page", () => {
    const p = sessionPost(hero("race", "Race"));
    expect(p.key).toBe("session:2026:20:Race");
    expect(p.text).toContain("🏁 <b>Гран-прі Сан-Паулу · Гонка</b>");
    expect(p.text).toContain("🥇 Max Verstappen (Red Bull)");
    expect(p.text).toContain("https://paddocktimes.com/uk/calendar/2026/20");
  });

  it("writes a driver f1db knows in Ukrainian", () => {
    const h = hero("race", "Race");
    h.top[0] = { ...h.top[0], driverId: "max-verstappen" };
    expect(sessionPost(h).text).toContain("🥇 Макс Ферстаппен (Red Bull)");
  });

  it("names the pole in qualifying and lists times in practice", () => {
    expect(sessionPost(hero("qualifying", "Qualifying")).text).toContain("Поул: Max Verstappen (Red Bull), 1:10.123");
    expect(sessionPost(hero("practice", "Practice 2")).text).toContain("2. Lewis Hamilton (Ferrari), +0.117");
  });

  it("gives the race-day preview the Kyiv start time and the facts", () => {
    const p = {
      season: "2026",
      round: 20,
      race: { name: "São Paulo", date: "2026-11-08", circuitName: "Autódromo José Carlos Pace" },
      circuit: { racesHeld: 42, lapRecord: { time: "1:10.540", year: 2018, driverName: "Valtteri Bottas" } },
      weather: [{ date: "2026-11-08", tMax: 19, tMin: 14, rain: 94, code: 53 }],
      gridWinners: [
        { id: "h", name: "Lewis Hamilton", count: 3 },
        { id: "v", name: "Max Verstappen", count: 3 },
      ],
    } as unknown as RacePreview;
    const post = previewPost(p, Date.parse("2026-11-08T17:00:00Z"));
    expect(post.text).toContain("неділя, 8 листопада о 19:00 за Києвом");
    expect(post.text).toContain("• Погода в день гонки: 19°, ймовірність дощу 94%");
    expect(post.text).toContain("• Lewis Hamilton і Max Verstappen: по 3 перемоги тут");
    expect(post.text).toContain("• Рекорд кола: 1:10.540, Valtteri Bottas, 2018");
  });

  it("escapes an article's text and links the season review", () => {
    const a = { slug: "x", title: "A & B", description: "<i>", date: "2026-11-07" } as ArticleSummary;
    expect(articlePost(a).text).toContain("<b>A &amp; B</b>");
    expect(articlePost(a).text).toContain("&lt;i&gt;");
    const r = {
      season: 2026,
      held: 21,
      driver: { id: "kimi-antonelli", name: "Kimi Antonelli", constructorName: "Mercedes" },
      team: { name: "Mercedes" },
      wins: [{}, {}],
    } as unknown as SeasonReview;
    expect(seasonPost(r).text).toContain("Чемпіон світу: Кімі Антонеллі (Mercedes)");
    expect(seasonPost(r).url).toBe("https://paddocktimes.com/uk/seasons/2026");
  });

  it("posts the season review only once it is final, for ten days after the last race", () => {
    const r = (final: boolean) => ({ final, winners: [{ date: "2026-11-29" }, { date: "2026-12-06" }] }) as unknown as SeasonReview;
    const at = (d: string) => Date.parse(`${d}T12:00:00Z`);
    expect(seasonFresh(r(false), at("2026-12-07"))).toBe(false);
    expect(seasonFresh(r(true), at("2026-12-07"))).toBe(true);
    expect(seasonFresh(r(true), at("2026-12-15"))).toBe(true);
    expect(seasonFresh(r(true), at("2026-12-20"))).toBe(false);
  });

  it("posts an article's teaser and a link to read it", () => {
    const a = { slug: "x", title: "T", description: "D", date: "2026-11-08" } as ArticleSummary;
    expect(articlePost(a, "Three short lines.").text).toBe("📝 <b>T</b>\n\nThree short lines.\n\nЧитати: https://paddocktimes.com/uk/articles/x");
    expect(articlePost(a).text).toContain("\n\nD\n\n");
  });

  it("recognises a post on the channel page whatever the markup", () => {
    const post = sessionPost(hero("race", "Race"));
    const page = `<div class="tgme_widget_message_text"><i class="emoji">🏁</i> <b>Гран-прі Сан-Паулу · Гонка</b><br/><br/>🥇 Max Verstappen (Red Bull)<br/></div>`;
    expect(signature(page).includes(postId(post))).toBe(true);
    expect(signature(page).includes(postId(sessionPost(hero("qualifying", "Qualifying"))))).toBe(false);
  });
});
