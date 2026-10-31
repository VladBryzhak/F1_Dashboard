import fs from "fs";
import os from "os";
import path from "path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./f1db", () => ({
  isDatasetReady: () => true,
  warmDataset: () => {},
  getCurrentSeason: async () => 2026,
  hasPageSubject: async () => false,
  hasRace: async () => false,
}));
// The page's own text and preview card don't matter here.
vi.mock("./og", () => ({ describePage: async () => ({ title: "T", description: "D", card: {} }) }));
vi.mock("./home", () => ({ homePayload: async () => ({}) }));
vi.mock("./jsonld", () => ({ pageJsonLd: async () => null }));

import { isUkPath, pageHtml, pageStatusFor, previewPath } from "./pageHtml";

// The parts of client/index.html the server rewrites.
const SHELL = `<!doctype html><html lang="en"><head>
<link rel="canonical" href="https://example.test/" />
<meta property="og:url" content="https://example.test/" />
<meta name="description" content="x" /><meta property="og:title" content="x" /><meta property="og:description" content="x" />
<meta name="twitter:title" content="x" /><meta name="twitter:description" content="x" />
<meta property="og:image" content="x" /><meta name="twitter:image" content="x" />
<title>Paddock Times</title><script type="module" src="/assets/index.js"></script>
</head><body><div id="root"></div></body></html>`;

let file: string;
beforeAll(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pt-")), "index.html");
  fs.writeFileSync(file, SHELL);
});

describe("pageHtml", () => {
  it("serves a 'not found' shell: noindex, no canonical or language twins, nonce kept", async () => {
    const html = await pageHtml(file, "/uk/nonexistent", "Mozilla/5.0", "abc", true);
    expect(html).toContain('<html lang="uk">');
    expect(html).toContain("<title>Сторінку не знайдено · Paddock Times</title>");
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("hreflang");
    expect(html).not.toContain("og:url");
    expect(html).toContain('<script nonce="abc" type="module"');
  });

  it("gives crawlers a 'not found' text with links to the sections", async () => {
    const html = await pageHtml(file, "/nonexistent", "Googlebot/2.1", "", true);
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain('href="/standings"');
  });

  it("pairs a page with its twin in the other language and writes the season", async () => {
    const html = await pageHtml(file, "/uk/standings", "Mozilla/5.0", "n");
    expect(html).toContain('hreflang="en" href="https://f1-dashboard-bryzhak.onrender.com/standings"');
    expect(html).toContain('hreflang="uk" href="https://f1-dashboard-bryzhak.onrender.com/uk/standings"');
    expect(html).toContain('href="https://f1-dashboard-bryzhak.onrender.com/uk/standings"'); // canonical
    expect(html).toContain("window.__SEASON__=2026");
  });
});

describe("pageStatusFor", () => {
  it("keeps the language prefix on a redirect", async () => {
    expect(await pageStatusFor("/uk/standings/2026", "Mozilla/5.0")).toEqual({ code: 301, location: "/uk/standings" });
    expect(await pageStatusFor("/standings/abc")).toEqual({ code: 301, location: "/standings" });
  });

  it("answers 404 for an unknown driver once the data is in", async () => {
    expect(await pageStatusFor("/drivers/nobody")).toEqual({ code: 404 });
  });
});

describe("path helpers", () => {
  it("tells Ukrainian paths and preview card paths", () => {
    expect(isUkPath("/uk")).toBe(true);
    expect(isUkPath("/uk/drivers")).toBe(true);
    expect(isUkPath("/ukraine")).toBe(false);
    expect(previewPath("/")).toBe("/og/index.png");
    expect(previewPath("/drivers/max-verstappen?x=1")).toBe("/og/drivers/max-verstappen.png");
  });
});
