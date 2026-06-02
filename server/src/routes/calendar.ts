import { Router } from "express";
import { getCalendar, getRaceResults } from "../services/f1db";

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

export default router;
