import fs from "fs";
import { isDatasetReady, warmDataset } from "./f1db";
import { describePage, type PageMeta } from "./og";

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

export async function pageHtml(file: string, pagePath: string, userAgent = ""): Promise<string> {
  let html = readShell(file);
  let meta: PageMeta | null = null;
  if (isDatasetReady()) {
    meta = await describePage(pagePath).catch(() => null);
  } else if (BOT.test(userAgent)) {
    meta = await Promise.race<PageMeta | null>([
      describePage(pagePath).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), BOT_WAIT_MS)),
    ]);
  } else {
    warmDataset();
  }
  const url = SITE_URL + (pagePath.split("?")[0].replace(/\/+$/, "") || "/");
  const image = SITE_URL + previewPath(pagePath);

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
  return html;
}
