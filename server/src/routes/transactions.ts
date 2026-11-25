import { Router, Response } from "express";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { DISCLAIMER } from "@finance-buddy/shared";

export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await db.transaction.findMany({
      where: { userId: req.user!.id },
      take: 50
    });

    return res.json({ transactions, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load transactions" });
  }
});
