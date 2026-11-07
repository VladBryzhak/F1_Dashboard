import { Router } from "express";
import { getSeasonReview } from "../services/f1db";

const router = Router();

// GET /api/seasons/:season/review -> the season's review: champion (or
// leader), every round's winner, first wins and teammate duels (404 for a
// season with no race run)
router.get("/:season/review", async (req, res, next) => {
  try {
    const season = Number(req.params.season);
    const review = Number.isInteger(season) ? await getSeasonReview(season) : null;
    if (!review) {
      return res.status(404).json({ error: "No review for this season" });
    }
    res.json(review);
  } catch (err) {
    next(err);
  }
});

export default router;
