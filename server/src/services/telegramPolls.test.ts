import { describe, expect, it } from "vitest";
import { answerText, canPost, findPost, introText, OTHER, pollOptions, pollSpecs } from "./telegramPolls";
import { signature } from "./telegramChannel";
import type { CalendarRace, DriverStanding } from "../types/f1";

const st = (driverId: string, givenName: string, familyName: string) => ({ driverId, givenName, familyName }) as DriverStanding;
const standings = [
  st("kimi-antonelli", "Kimi", "Antonelli"),
  st("max-verstappen", "Max", "Verstappen"),
  st("lando-norris", "Lando", "Norris"),
  st("george-russell", "George", "Russell"),
  st("left-the-grid", "Old", "Driver"),
  st("lewis-hamilton", "Lewis", "Hamilton"),
  st("charles-leclerc", "Charles", "Leclerc"),
  st("oscar-piastri", "Oscar", "Piastri"),
  st("isack-hadjar", "Isack", "Hadjar"),
  st("liam-lawson", "Liam", "Lawson"),
  st("ted-whiteaway", "Ted", "Whiteaway"),
];

const vegas = {
  round: 21,
  name: "Las Vegas",
  sessions: [
    { kind: "FP1", start: "2026-11-20T00:30:00Z", timeKnown: true },
    { kind: "Q", start: "2026-11-21T04:00:00Z", timeKnown: true },
    { kind: "RACE", start: "2026-11-22T04:00:00Z", timeKnown: true },
  ],
} as unknown as CalendarRace;

const at = (iso: string) => Date.parse(iso);

describe("weekend polls", () => {
  it("asks about the nine highest in the standings who still race, and someone else", () => {
    const racing = new Set(standings.map((s) => s.driverId).filter((id) => id !== "left-the-grid"));
    const opts = pollOptions(standings, racing);
    expect(opts).toHaveLength(10);
    expect(opts[0]).toEqual({ driverId: "kimi-antonelli", text: "Кімі Антонеллі" });
    expect(opts.map((o) => o.driverId)).not.toContain("left-the-grid");
    expect(opts[9]).toEqual({ driverId: null, text: OTHER });
  });

  it("opens 30 hours before the weekend and closes when the session starts", () => {
    const opts = pollOptions(standings);
    expect(pollSpecs(2026, [vegas], opts, at("2026-11-18T18:00:00Z"))).toEqual([]); // too early
    const specs = pollSpecs(2026, [vegas], opts, at("2026-11-19T10:00:00Z"));
    expect(specs.map((s) => [s.kind, s.question])).toEqual([
      ["Q", "🗳 Гран-прі Лас-Вегаса 2026: хто виграє кваліфікацію?"],
      ["RACE", "🗳 Гран-прі Лас-Вегаса 2026: хто виграє гонку?"],
    ]);
    expect(specs.every((s) => canPost(s, at("2026-11-19T10:00:00Z")))).toBe(true);
    // after qualifying has started only the race poll may still be posted
    const sat = pollSpecs(2026, [vegas], opts, at("2026-11-21T05:00:00Z"));
    expect(sat.filter((s) => canPost(s, at("2026-11-21T05:00:00Z"))).map((s) => s.kind)).toEqual(["RACE"]);
    // two days after the race nothing is left to do
    expect(pollSpecs(2026, [vegas], opts, at("2026-11-24T05:00:00Z"))).toEqual([]);
  });

  it("introduces the polls and finds that post again on the channel page", () => {
    const intro = introText("Las Vegas", 2026, ["Q", "RACE"], "https://paddocktimes.com/uk/calendar/2026/21");
    expect(intro.split("\n")[0]).toBe("🗳 <b>Гран-прі Лас-Вегаса 2026: прогнози на вікенд</b>");
    const html =
      '<div class="tgme_widget_message" data-post="paddocktimes/41"><div class="tgme_widget_message_text">Інше</div></div>' +
      '<div class="tgme_widget_message" data-post="paddocktimes/42"><div class="tgme_widget_message_text">🗳 <b>Гран-прі Лас-Вегаса 2026: прогнози на вікенд</b><br/>Хто виграє…</div></div>';
    expect(findPost(html, intro.split("\n")[0], signature)).toBe(42);
    expect(findPost(html, "🗳 <b>Гран-прі Катару 2026: прогнози на вікенд</b>", signature)).toBeNull();
  });

  it("gives the answer with how many guessed it, or 'someone else' for a driver not listed", () => {
    const [q] = pollSpecs(2026, [vegas], pollOptions(standings), at("2026-11-21T06:00:00Z"));
    const url = "https://paddocktimes.com/uk/calendar/2026/21";
    const count = { total: 40, options: [{ text: "Кімі Антонеллі", votes: 10 }, { text: "Ландо Норріс", votes: 14 }, { text: OTHER, votes: 1 }] };
    expect(answerText(q, { driverId: "lando-norris", name: "Lando Norris" }, count, url)).toBe(
      [
        "🎯 <b>Гран-прі Лас-Вегаса · опитування: кваліфікація</b>",
        "",
        "Поул: Ландо Норріс.",
        "Вгадали 35%: 14 голосів з 40.",
        "",
        `Результати й анонс гонки: ${url}`,
      ].join("\n"),
    );
    const other = answerText(q, { driverId: "nico-hulkenberg", name: "Nico Hulkenberg" }, count, url);
    expect(other).toContain("Поул: Ніко Гюлькенберг (в опитуванні це «Інший пілот»).");
    expect(other).toContain("Вгадали 3%: 1 голос з 40.");
    expect(answerText(q, { driverId: "lando-norris", name: "Lando Norris" }, null, url)).not.toContain("Вгадали");
  });
});
