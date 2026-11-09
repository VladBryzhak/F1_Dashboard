import { Router } from "express";
import { getRecords } from "../services/f1db";

const router = Router();

// GET /api/records -> all-time records: drivers' titles, wins, poles,
// podiums, starts, fastest laps, wins in a season, youngest winners; teams'
// titles, wins, poles (top ten of each)
router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=3600").json(await getRecords());
  } catch (err) {
    next(err);
  }
});

export default router;
