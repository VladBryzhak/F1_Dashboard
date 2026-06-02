import { Router } from "express";
import { getCalendar } from "../services/f1db";

const router = Router();

// GET /api/calendar/:season
router.get("/:season", async (req, res, next) => {
  try {
    res.json(await getCalendar(req.params.season));
  } catch (err) {
    next(err);
  }
});

export default router;
