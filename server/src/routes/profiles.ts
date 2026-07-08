import { Router } from "express";
import { getConstructorProfile, getDriverProfile } from "../services/f1db";

const router = Router();

// GET /api/drivers/:driverId
router.get("/drivers/:driverId", async (req, res, next) => {
  try {
    const profile = await getDriverProfile(req.params.driverId);
    if (!profile) {
      return res
        .status(404)
        .json({ error: `Unknown driver: ${req.params.driverId}` });
    }
    res.json(profile);
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
