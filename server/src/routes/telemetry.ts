import { Router } from "express";
import {
  getDriverHeadshots,
  getDriverLaps,
  getLapTelemetry,
  getRaceSessions,
  getSessionDrivers,
} from "../services/openf1";

const router = Router();

// GET /api/telemetry/headshots/:season
router.get("/headshots/:season", async (req, res, next) => {
  try {
    res.json(await getDriverHeadshots(req.params.season));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/sessions/:season
router.get("/sessions/:season", async (req, res, next) => {
  try {
    res.json(await getRaceSessions(req.params.season));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/drivers/:sessionKey
router.get("/drivers/:sessionKey", async (req, res, next) => {
  try {
    res.json(await getSessionDrivers(Number(req.params.sessionKey)));
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/laps/:sessionKey/:driverNumber
router.get("/laps/:sessionKey/:driverNumber", async (req, res, next) => {
  try {
    res.json(
      await getDriverLaps(
        Number(req.params.sessionKey),
        Number(req.params.driverNumber)
      )
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/lap/:sessionKey/:driverNumber/:lapNumber
router.get(
  "/lap/:sessionKey/:driverNumber/:lapNumber",
  async (req, res, next) => {
    try {
      res.json(
        await getLapTelemetry(
          Number(req.params.sessionKey),
          Number(req.params.driverNumber),
          Number(req.params.lapNumber)
        )
      );
    } catch (err) {
      next(err);
    }
  }
);

export default router;
