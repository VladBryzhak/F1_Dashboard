import { Router } from "express";
import {
  getDriverPhoto,
  getDriverPhotos,
} from "../services/driverPhotos";
import {
  getAllDrivers,
  getConstructorProfile,
  getDriverComparison,
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
