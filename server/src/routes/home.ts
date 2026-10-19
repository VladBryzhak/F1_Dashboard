import { Router } from "express";
import { homePayload } from "../services/home";

const router = Router();

// GET /api/home — weekend highlights, championship top 5 and latest news
// headlines. News is best-effort: a feed failure returns an empty list rather
// than failing the page.
router.get("/", async (_req, res, next) => {
  try {
    res.json(await homePayload());
  } catch (err) {
    next(err);
  }
});

export default router;
