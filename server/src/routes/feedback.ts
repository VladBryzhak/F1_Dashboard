import { Router } from "express";
import { sendFeedback } from "../services/telegram";

const router = Router();

// A public form that forwards to a private chat is an obvious spam target, so
// it is rate limited per sender and, as a backstop, for the whole form.
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 5; // per sender
const MAX_TOTAL_PER_HOUR = 30; // all senders together
const hits = new Map<string, number[]>();
let recentTotal: number[] = [];

function rateLimited(ip: string): boolean {
  const now = Date.now();
  recentTotal = recentTotal.filter((t) => now - t < 60 * 60 * 1000);
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW || recentTotal.length >= MAX_TOTAL_PER_HOUR) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  recentTotal.push(now);
  hits.set(ip, recent);
  return false;
}

// Forget senders whose window has passed, so the map can't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(ip);
  }
}, WINDOW_MS).unref();

// The sender's address. Traffic reaches Render through Cloudflare, which sets
// CF-Connecting-IP itself (a value sent by the client is replaced), while
// X-Forwarded-For is only appended to, so its entries can be forged; it is
// used only when the Cloudflare header is missing, and the hourly cap above
// still holds if someone forges it.
function clientIp(req: { headers: Record<string, unknown>; ip?: string }): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf) return cf.trim();
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip ?? "unknown";
}

// POST /api/feedback  { message, contact?, website? }
// `website` is a honeypot: it's hidden from real users, so a filled value means
// a bot — we accept the request so the bot sees success, but send nothing.
router.post("/", async (req, res, next) => {
  try {
    const { message, contact, website } = (req.body ?? {}) as {
      message?: unknown;
      contact?: unknown;
      website?: unknown;
    };

    if (typeof website === "string" && website.trim() !== "") {
      return res.json({ ok: true });
    }

    const text = typeof message === "string" ? message.trim() : "";
    if (text.length < 3) {
      return res.status(400).json({ error: "Please write a little more." });
    }
    if (text.length > 2000) {
      return res
        .status(400)
        .json({ error: "Message is too long (2000 characters max)." });
    }

    if (rateLimited(clientIp(req))) {
      return res
        .status(429)
        .json({ error: "Too many messages — please try again later." });
    }

    const contactStr =
      typeof contact === "string" && contact.trim()
        ? contact.trim().slice(0, 200)
        : undefined;

    await sendFeedback(text, contactStr);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
