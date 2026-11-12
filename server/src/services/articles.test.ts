import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./f1db", () => ({ getCalendar: async () => ({ races: [] }) }));

import { loadArticles, readBlock, readingMinutes, renderBody, splitFrontMatter } from "./articles";

describe("front matter and blocks", () => {
  it("reads the front matter and leaves the body", () => {
    const { fields, body } = splitFrontMatter("---\ntitle: Antonelli: champion\ndescription: Five numbers\n---\nText");
    expect(fields).toEqual({ title: "Antonelli: champion", description: "Five numbers" });
    expect(body).toBe("Text");
  });

  it("reads key: value lines and - label: value rows in order", () => {
    expect(readBlock("title: In numbers\n- Points: 380\n- Wins: 9\nsource: f1db")).toEqual({
      fields: { title: "In numbers", source: "f1db" },
      rows: [
        ["Points", "380"],
        ["Wins", "9"],
      ],
    });
  });
});

describe("renderBody", () => {
  it("keeps the Ukrainian text on Ukrainian pages and opens other sites in a new tab", () => {
    const md = "[profile](/drivers/kimi-antonelli), [home](/) and [F1](https://www.formula1.com)";
    expect(renderBody(md, "uk")).toContain('<a href="/uk/drivers/kimi-antonelli">profile</a>');
    expect(renderBody(md, "uk")).toContain('<a href="/uk">home</a>');
    expect(renderBody(md, "en")).toContain('<a href="/drivers/kimi-antonelli">profile</a>');
    expect(renderBody(md, "en")).toContain('href="https://www.formula1.com" rel="noopener noreferrer" target="_blank"');
  });

  it("shows raw HTML as text", () => {
    const html = renderBody('Hi <script>alert(1)</script> <img src=x onerror="y">', "en");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });

  it("draws the stats block", () => {
    const html = renderBody("```stats\ntitle: In numbers\n- Points: 380\nsource: f1db\n```", "en");
    expect(html).toContain('<aside class="art-stats"><h2 class="art-stats-title">In numbers</h2>');
    expect(html).toContain('<dl class="art-stat-tiles"><div><dt>Points</dt><dd><span class="art-stat-num mono">380</span></dd></div></dl>');
    expect(html).toContain("Data: f1db");
  });

  it("draws each stat by its shape, keeping the order", () => {
    const html = renderBody(
      "```stats\n- Gap: 45 points\n- Run: 7th, 7th, 9th\n- Tyres: soft 1 to 20, hard 21 to 57\n- Gain: +17\n```",
      "en",
    );
    expect(html).toContain('<span class="art-stat-num mono">45</span> <span class="art-stat-unit">points</span>');
    expect(html).toContain('<ol class="art-stat-chips"><li class="mono">7th</li><li class="mono">7th</li><li class="mono">9th</li></ol>');
    expect(html).toContain('<dt>Tyres</dt><dd>soft 1 to 20, hard 21 to 57</dd>');
    expect(html.match(/<dl class="art-stat-/g)).toHaveLength(3);
    expect(html.indexOf("Gap")).toBeLessThan(html.indexOf("Tyres"));
    expect(html.indexOf("Tyres")).toBeLessThan(html.indexOf("Gain"));
  });

  it("puts an Instagram post behind a button, and only a real Instagram post", () => {
    const html = renderBody("```instagram\nurl: https://instagram.com/p/AbC_12-x?igsh=1\nhandle: @kimi.antonelli\n```", "uk");
    expect(html).toContain('data-ig="https://www.instagram.com/p/AbC_12-x/"');
    expect(html).toContain("Показати пост");
    expect(html).toContain("@kimi.antonelli");
    expect(renderBody("```instagram\nurl: https://evil.example/p/x/\n```", "en")).toBe("");
  });

  it("takes a photo from our own files or https, with its credit", () => {
    const html = renderBody("```figure\nsrc: /media/a.webp\nalt: Kimi\ncredit: Mercedes\ncreditUrl: https://www.mercedesamgf1.com\n```", "en");
    expect(html).toContain('<img src="/media/a.webp" alt="Kimi"');
    expect(html).toContain('Photo: <a href="https://www.mercedesamgf1.com"');
    expect(renderBody("```figure\nsrc: javascript:alert(1)\n```", "en")).toBe("");
  });

  it("leaves other code blocks as code", () => {
    expect(renderBody("```\nx = 1\n```", "en")).toContain("<pre><code>x = 1");
  });
});

it("counts reading time without the blocks, rounded up", () => {
  expect(readingMinutes("word ".repeat(201))).toBe(2);
  expect(readingMinutes("```stats\n" + "- A: 1\n".repeat(500) + "```\nshort")).toBe(1);
});

describe("loadArticles", () => {
  let dir = "";
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (slug: string, files: Record<string, string>) => {
    fs.mkdirSync(path.join(dir, slug), { recursive: true });
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, slug, name), text);
  };
  const meta = (date: string, day = "sun") =>
    JSON.stringify({ date, season: 2026, round: 19, day, tag: "race", cover: { reading: "P1" } });
  const text = "---\ntitle: T\ndescription: D\n---\nBody";

  it("publishes complete articles newest first and leaves out broken ones", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "articles-"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    write("older", { "meta.json": meta("2026-10-25"), "en.md": text, "uk.md": text });
    write("newer", { "meta.json": meta("2026-11-01"), "en.md": text, "uk.md": text });
    write("same-day-saturday", { "meta.json": meta("2026-11-01", "sat"), "en.md": text, "uk.md": text });
    write("no-ukrainian", { "meta.json": meta("2026-11-02"), "en.md": text });
    write("bad-day", { "meta.json": meta("2026-11-02", "monday"), "en.md": text, "uk.md": text });
    write("Bad_Name", { "meta.json": meta("2026-11-02"), "en.md": text, "uk.md": text });
    expect(loadArticles(dir).map((a) => a.slug)).toEqual(["newer", "same-day-saturday", "older"]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });
});
