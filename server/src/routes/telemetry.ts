import { Router } from "express";
import {
  getDriverHeadshots,
  getDriverLaps,
  getLapTelemetry,
  getRaceSessions,
  getSessionDrivers,
} from "../services/openf1";
import {
  DRIVER_NUMBER_MAX,
  LAP_MAX,
  OPENF1_FIRST_SEASON,
  SESSION_KEY_MAX,
  intParam,
  lastSeasonAllowed,
} from "./params";

const router = Router();

// GET /api/telemetry/headshots/:season
router.get("/headshots/:season", async (req, res, next) => {
  try {
    const season = intParam(req.params.season, OPENF1_FIRST_SEASON, lastSeasonAllowed());
    // Seasons OpenF1 doesn't cover simply have no headshots.
    if (season == null) return res.json({});
    res.json(await getDriverHeadshots(String(season)));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/sessions/:season
router.get("/sessions/:season", async (req, res, next) => {
  try {
    const season = intParam(req.params.season, OPENF1_FIRST_SEASON, lastSeasonAllowed());
    if (season == null) return res.json([]);
    res.json(await getRaceSessions(String(season)));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/drivers/:sessionKey
router.get("/drivers/:sessionKey", async (req, res, next) => {
  try {
    const key = intParam(req.params.sessionKey, 1, SESSION_KEY_MAX);
    if (key == null) return res.status(400).json({ error: "Invalid session key." });
    res.json(await getSessionDrivers(key));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/laps/:sessionKey/:driverNumber
router.get("/laps/:sessionKey/:driverNumber", async (req, res, next) => {
  try {
    const key = intParam(req.params.sessionKey, 1, SESSION_KEY_MAX);
    const driver = intParam(req.params.driverNumber, 1, DRIVER_NUMBER_MAX);
    if (key == null || driver == null) return res.status(400).json({ error: "Invalid parameters." });
    res.json(await getDriverLaps(key, driver));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/lap/:sessionKey/:driverNumber/:lapNumber
router.get(
  "/lap/:sessionKey/:driverNumber/:lapNumber",
  async (req, res, next) => {
    try {
      const key = intParam(req.params.sessionKey, 1, SESSION_KEY_MAX);
      const driver = intParam(req.params.driverNumber, 1, DRIVER_NUMBER_MAX);
      const lap = intParam(req.params.lapNumber, 1, LAP_MAX);
      if (key == null || driver == null || lap == null) {
        return res.status(400).json({ error: "Invalid parameters." });
      }
      res.json(await getLapTelemetry(key, driver, lap));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
