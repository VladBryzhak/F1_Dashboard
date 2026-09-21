import { Router } from "express";
import {
  getConstructorStandings,
  getDriverStandings,
  getSeasonProgression,
} from "../services/f1db";

const router = Router();

// GET /api/standings/progression/:season — per-round title-race chart data
router.get("/progression/:season", async (req, res, next) => {
  try {
    res.json(await getSeasonProgression(req.params.season));
  } catch (err) {
    next(err);
  }
});

// GET /api/standings/drivers/:season
router.get("/drivers/:season", async (req, res, next) => {
  try {
    res.json(await getDriverStandings(req.params.season));
  } catch (err) {
    next(err);
  }
});

// GET /api/standings/constructors/:season
router.get("/constructors/:season", async (req, res, next) => {
  try {
    res.json(await getConstructorStandings(req.params.season));
  } catch (err) {
    next(err);
  }
});

export default router;
