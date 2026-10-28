import crypto from "crypto";

// Content-Security-Policy for the HTML pages: the browser may only run our
// own scripts and the Google Analytics tag, load images from the hosts the
// site actually uses, and send data only to us and Google Analytics. Even if
// someone managed to inject markup into a page, a script of theirs wouldn't
// run. Inline scripts we write ourselves (the home page's data) carry a
// per-response nonce; the one inline event handler in index.html (the
// non-blocking fonts.css) is allowed by its hash.
// GA4 hosts follow Google's CSP guide (tag-platform/security/guides/csp).

const FONTS_ONLOAD_HASH = "'sha256-1jAmyYXcRq6zFldLe/GCgIDJBiOONdXjTLgEFMDnDSM='"; // this.onload=null;this.rel='stylesheet'

const GA_SCRIPT = "https://*.googletagmanager.com";
const GA_CONNECT = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
  "https://www.google.com",
];
const GA_IMG = ["https://*.google-analytics.com", "https://*.googletagmanager.com", "https://www.google.com"];

// Images: formula1.com portraits and cars, flags, Wikimedia photos and logos.
const IMG_HOSTS = ["https://media.formula1.com", "https://flagcdn.com", "https://upload.wikimedia.org"];

export const newNonce = () => crypto.randomBytes(16).toString("base64");

export function cspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-hashes' ${FONTS_ONLOAD_HASH} ${GA_SCRIPT}`,
    // React sets style attributes (team colours, widths) and the main
    // stylesheet is inlined for speed, so inline styles stay allowed.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${[...IMG_HOSTS, ...GA_IMG].join(" ")}`,
    "font-src 'self'",
    `connect-src 'self' ${GA_CONNECT.join(" ")}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
