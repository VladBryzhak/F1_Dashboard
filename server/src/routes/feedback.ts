import { Router } from "express";
import { sendFeedback } from "../services/telegram";

const router = Router();

// A public form that forwards to a private chat is an obvious spam target, so a
// small in-memory limiter caps how many messages one IP can send per window.
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(req: {
  headers: Record<string, unknown>;
  ip?: string;
}): string {
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
