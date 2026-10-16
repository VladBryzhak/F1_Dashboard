import { Router } from "express";
import { getCircuitProfile, getCircuits } from "../services/f1db";

const router = Router();

// GET /api/circuits — every circuit, current-calendar ones first
router.get("/", async (_req, res, next) => {
  try {
    res.json(await getCircuits());
  } catch (err) {
    next(err);
  }
});

// GET /api/circuits/:circuitId — facts, lap record, winners, layouts
router.get("/:circuitId", async (req, res, next) => {
  try {
    const profile = await getCircuitProfile(req.params.circuitId);
    if (!profile) {
      res.status(404).json({ error: "Circuit not found" });
      return;
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;
