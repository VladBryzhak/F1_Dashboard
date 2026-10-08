import { Router } from "express";
import {
  getBoard,
  getDriverDetail,
  getLatestSession,
  getLiveStatus,
} from "../services/live";

const router = Router();

// GET /api/live/status — is a session live now, what's next, what was last, and
// which session the board should show.
router.get("/status", async (_req, res, next) => {
  try {
    res.json(await getLiveStatus());
  } catch (err) {
    next(err);
  }
});

// GET /api/live/session — the latest completed session (kept for compatibility).
router.get("/session", async (_req, res, next) => {
  try {
    const session = await getLatestSession();
    if (!session) return res.status(404).json({ error: "No session available." });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// GET /api/live/:sessionKey/board — the live timing board for a session.
router.get("/:sessionKey/board", async (req, res, next) => {
  try {
    const key = Number(req.params.sessionKey);
    if (!Number.isFinite(key)) {
      return res.status(400).json({ error: "Invalid session key." });
    }
    res.json(await getBoard(key));
  } catch (err) {
    next(err);
  }
});

// GET /api/live/:sessionKey/driver/:num — expanded detail for one driver.
router.get("/:sessionKey/driver/:num", async (req, res, next) => {
  try {
    const key = Number(req.params.sessionKey);
    const num = Number(req.params.num);
    if (!Number.isFinite(key) || !Number.isFinite(num)) {
      return res.status(400).json({ error: "Invalid parameters." });
    }
    res.json(await getDriverDetail(key, num));
  } catch (err) {
    next(err);
  }
});

export default router;
