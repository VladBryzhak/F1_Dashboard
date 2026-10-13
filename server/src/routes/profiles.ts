import { Router } from "express";
import {
  getDriverPhoto,
  getDriverPhotos,
} from "../services/driverPhotos";
import { getTeamImages } from "../services/teamImages";
import {
  getAllDrivers,
  getAllConstructors,
  getConstructorProfile,
  getDriverComparison,
  getSeasonComparison,
  getDriverProfile,
} from "../services/f1db";

const router = Router();

// GET /api/drivers — lightweight list of all drivers (for comparison pickers)
router.get("/drivers", async (_req, res, next) => {
  try {
    res.json(await getAllDrivers());
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/photos — map of driverId -> Wikimedia photo URL. Registered
// before /drivers/:driverId so "photos" isn't read as a driver id.
router.get("/drivers/photos", async (_req, res, next) => {
  try {
    res.json(await getDriverPhotos());
  } catch (err) {
    next(err);
  }
});

// GET /api/compare/drivers/:a/:b — head-to-head comparison of two drivers
router.get("/compare/drivers/:a/:b", async (req, res, next) => {
  try {
    const cmp = await getDriverComparison(req.params.a, req.params.b);
    if (!cmp) {
      return res.status(404).json({ error: "One or both drivers not found" });
    }
    res.json(cmp);
  } catch (err) {
    next(err);
  }
});

// GET /api/compare/drivers/:a/:b/season/:season — compare two drivers within
// one season (season totals + that season's head-to-head).
router.get("/compare/drivers/:a/:b/season/:season", async (req, res, next) => {
  try {
    const season = Number(req.params.season);
    if (!Number.isInteger(season)) {
      return res.status(400).json({ error: "Invalid season" });
    }
    const cmp = await getSeasonComparison(req.params.a, req.params.b, season);
    if (!cmp) {
      return res.status(404).json({ error: "One or both drivers not found" });
    }
    res.json(cmp);
  } catch (err) {
    next(err);
  }
});

// GET /api/drivers/:driverId
router.get("/drivers/:driverId", async (req, res, next) => {
  try {
    const profile = await getDriverProfile(req.params.driverId);
    if (!profile) {
      return res
        .status(404)
        .json({ error: `Unknown driver: ${req.params.driverId}` });
    }
    const photoUrl = await getDriverPhoto(
      `${profile.givenName} ${profile.familyName}`,
    ).catch(() => null);
    res.json({ ...profile, photoUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/constructors — lightweight list of all constructors (for search).
// Registered before /constructors/:constructorId so "list" semantics win.
router.get("/constructors", async (_req, res, next) => {
  try {
    res.json(await getAllConstructors());
  } catch (err) {
    next(err);
  }
});

// GET /api/constructors/images — map of constructorId -> { url, type } for
// teams with a free (PD/CC) logo or photo. Registered before /:constructorId.
router.get("/constructors/images", async (_req, res, next) => {
  try {
    res.json(await getTeamImages());
  } catch (err) {
    next(err);
  }
});

// GET /api/constructors/:constructorId
router.get("/constructors/:constructorId", async (req, res, next) => {
  try {
    const profile = await getConstructorProfile(req.params.constructorId);
    if (!profile) {
      return res
        .status(404)
        .json({ error: `Unknown constructor: ${req.params.constructorId}` });
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;
