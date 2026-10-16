import { Router } from "express";
import {
  getCalendar,
  getRaceResults,
  getRaceWeekend,
} from "../services/f1db";
import { getRaceStrategy } from "../services/strategy";

const router = Router();

// GET /api/calendar/:season
router.get("/:season", async (req, res, next) => {
  try {
    res.json(await getCalendar(req.params.season));
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar/:season/:round  -> full race classification
router.get("/:season/:round", async (req, res, next) => {
  try {
    res.json(await getRaceResults(req.params.season, req.params.round));
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar/:season/:round/weekend -> qualifying, race + grid delta,
// fastest lap and driver of the day
router.get("/:season/:round/weekend", async (req, res, next) => {
  try {
    const weekend = await getRaceWeekend(req.params.season, req.params.round);
    if (!weekend) {
      return res.status(404).json({ error: "Race not found" });
    }
    res.json(weekend);
  } catch (err) {
    next(err);
  }
});

// GET /api/calendar/:season/:round/strategy?kind=race|sprint -> lap chart and
// tyre strategy (OpenF1, 2023+)
router.get("/:season/:round/strategy", async (req, res, next) => {
  try {
    const kind = req.query.kind === "sprint" ? "sprint" : "race";
    const data = await getRaceStrategy(req.params.season, req.params.round, kind);
    if (!data) {
      return res.status(404).json({ error: "No lap data for this race" });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
