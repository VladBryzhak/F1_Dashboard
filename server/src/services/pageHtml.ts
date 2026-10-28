import fs from "fs";
import path from "path";
import { isDatasetReady, warmDataset } from "./f1db";
import { homePayload } from "./home";
import { describePage, type PageMeta } from "./og";
import { pageSnapshot } from "./snapshot";

// Serves the SPA shell with this page's own <title>, description, canonical
// URL and Open Graph / Twitter tags, so link previews show the right page
// (crawlers don't run our JavaScript). The browser app takes over as usual.

export const SITE_URL = "https://f1-dashboard-bryzhak.onrender.com";
// Link-preview crawlers get the page's own tags even on a cold start (they
// wait); people get the page at once, with the site defaults until the
// dataset has loaded, so a cold start never delays the first paint.
const BOT = /bot|crawler|spider|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|linkedin|skype|embedly|vkshare|pinterest|preview/i;
const BOT_WAIT_MS = 8000;

let shell: { mtime: number; html: string } | null = null;
function readShell(file: string): string {
  const mtime = fs.statSync(file).mtimeMs;
  if (!shell || shell.mtime !== mtime) shell = { mtime, html: fs.readFileSync(file, "utf8") };
  return shell.html;
}

// The app's main stylesheet is small; inlining it saves a render-blocking
// round trip before the first paint. Cached per file (hashed names).
const cssCache = new Map<string, string>();
function inlineCss(html: string, file: string): string {
  return html.replace(
    /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
    (tag, href: string) => {
      let css = cssCache.get(href);
      if (css == null) {
        try {
          css = fs.readFileSync(path.join(path.dirname(file), href), "utf8");
        } catch {
          return tag;
        }
        cssCache.set(href, css);
      }
      return `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
    },
  );
}

// JSON inside <script>: escape "<" so the payload can't close the tag.
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

// Home page: inline its data (window.__HOME__) and preload the hero photo, so
// the largest image starts downloading with the HTML instead of after the
// script, the page chunk and the API call.
async function homeBoot(): Promise<string> {
  try {
    const data = await homePayload(150);
    const preload = data.heroImage
      ? `<link rel="preload" as="image" href="${attr(data.heroImage)}"` +
        (data.heroSrcSet
          ? ` imagesrcset="${attr(data.heroSrcSet)}" imagesizes="${attr(data.heroSizes)}"`
          : "") +
        ` fetchpriority="high" />`
      : "";
    return `${preload}<script>window.__HOME__=${scriptJson(data)}</script>`;
  } catch {
    return "";
  }
}

const attr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Replace one <meta>/<link> tag's content/href, matched by its key attribute.
function setTag(html: string, key: string, value: string, field = "content"): string {
  const re = new RegExp(`(<(?:meta|link)\\s+${key}\\s+${field}=")[^"]*(")`, "s");
  return html.replace(re, `$1${attr(value)}$2`);
}

export function previewPath(pagePath: string): string {
  const clean = pagePath.split("?")[0].replace(/\/+$/, "");
  return `/og${clean || "/index"}.png`;
}

// Ukrainian pages live at /uk/… (the app's router basename); the server reads
// the language from the path and looks the page up by its unprefixed path.
const UK_PREFIX = /^\/uk(?=\/|$)/;
export const isUkPath = (pagePath: string) => UK_PREFIX.test(pagePath);

export async function pageHtml(file: string, rawPath: string, userAgent = "", nonce = ""): Promise<string> {
  let html = readShell(file);
  const uk = isUkPath(rawPath);
  // The page itself, without the language prefix (/uk/standings → /standings).
  const pagePath = rawPath.replace(UK_PREFIX, "") || "/";
  if (uk) html = html.replace('<html lang="en">', '<html lang="uk">');
  let meta: PageMeta | null = null;
  const lang = uk ? "uk" : "en";
  if (isDatasetReady()) {
    meta = await describePage(pagePath, lang).catch(() => null);
  } else if (BOT.test(userAgent)) {
    meta = await Promise.race<PageMeta | null>([
      describePage(pagePath, lang).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), BOT_WAIT_MS)),
    ]);
  } else {
    warmDataset();
  }
  // The canonical URL keeps the page's own language prefix.
  const url = SITE_URL + (rawPath.split("?")[0].replace(/\/+$/, "") || "/");
  // The preview card in the page's language (/og/uk/… for Ukrainian pages).
  const image = SITE_URL + previewPath(rawPath);

  if (meta) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${attr(meta.title)}</title>`);
    html = setTag(html, 'name="description"', meta.description);
    html = setTag(html, 'property="og:title"', meta.title);
    html = setTag(html, 'property="og:description"', meta.description);
    html = setTag(html, 'name="twitter:title"', meta.title);
    html = setTag(html, 'name="twitter:description"', meta.description);
  }
  html = setTag(html, 'rel="canonical"', url, "href");
  html = setTag(html, 'property="og:url"', url);
  html = setTag(html, 'property="og:image"', image);
  html = setTag(html, 'property="og:image:width"', "1200");
  html = setTag(html, 'property="og:image:height"', "630");
  html = setTag(html, 'name="twitter:image"', image);

  // The page in both languages, so search engines pair them (English is the
  // default for everyone else).
  const bare = pagePath.split("?")[0].replace(/\/+$/, "");
  const enUrl = SITE_URL + (bare || "/");
  const ukUrl = SITE_URL + "/uk" + bare;
  html = html.replace(
    "</head>",
    `<link rel="alternate" hreflang="en" href="${attr(enUrl)}" />` +
      `<link rel="alternate" hreflang="uk" href="${attr(ukUrl)}" />` +
      `<link rel="alternate" hreflang="x-default" href="${attr(enUrl)}" />` +
      `<meta property="og:locale" content="${uk ? "uk_UA" : "en_GB"}" />` +
      `<meta property="og:locale:alternate" content="${uk ? "en_GB" : "uk_UA"}" />` +
      "</head>",
  );

  const clean = pagePath.split("?")[0].replace(/\/+$/, "");
  if (clean === "" && isDatasetReady()) html = html.replace("</head>", `${await homeBoot()}</head>`);
  // Crawlers also get the page's text and links in #root (see snapshot.ts);
  // people get the empty root and the app, so their first paint is unchanged.
  if (BOT.test(userAgent) && isDatasetReady()) {
    const snapshot = await pageSnapshot(pagePath, lang).catch(() => "");
    if (snapshot) html = html.replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`);
  }
  // Every <script> of ours (the app bundle, the inlined home data) carries the
  // response's CSP nonce (see services/csp.ts).
  if (nonce) html = html.replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
  return inlineCss(html, file);
}
