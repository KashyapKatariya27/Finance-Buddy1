import { Router, Response } from "express";
import { PlanSplitSchema, CurrencySchema, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const walletRouter = Router();

walletRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      include: { wallet: true, plan: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      wallet: user.wallet || { everydayCents: 0, savingsCents: 0, emergencyCents: 0 },
      plan: user.plan || { splitEveryday: 50, splitEmergency: 20, splitSavings: 30, monthlyExpensesCents: 2000000 },
      currency: user.currency,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch wallet" });
  }
});

walletRouter.post("/fund", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, amount, note } = req.body;
    const amountCents = Math.round(Number(amount) * 100);

    if (isNaN(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const recipientId = targetUserId ? parseInt(targetUserId, 10) : req.user!.id;
    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      include: { wallet: true, plan: true }
    });

    if (!recipient) {
      return res.status(404).json({ error: "Recipient user not found" });
    }

    // Server-side permission check
    if (recipientId !== req.user!.id && recipient.parentId !== req.user!.id) {
      return res.status(403).json({ error: "Permission denied: you can only fund your own or your linked child's wallet." });
    }

    const splitEveryday = recipient.plan?.splitEveryday ?? 50;
    const splitEmergency = recipient.plan?.splitEmergency ?? 20;

    const everydayShare = Math.round((amountCents * splitEveryday) / 100);
    const emergencyShare = Math.round((amountCents * splitEmergency) / 100);
    const savingsShare = amountCents - everydayShare - emergencyShare;

    const updatedWallet = await db.$transaction(async (tx: any) => {
      const w = await tx.wallet.update({
        where: { userId: recipient.id },
        data: {
          everydayCents: { increment: everydayShare },
          emergencyCents: { increment: emergencyShare },
          savingsCents: { increment: savingsShare }
        }
      });

      await tx.transaction.create({
        data: {
          userId: recipient.id,
          walletType: "everyday",
          type: "fund_allocation",
          amountCents,
          note: note || `Fund allocation from ${req.user!.fullName} (Everyday +${(everydayShare / 100).toFixed(2)}, Emergency +${(emergencyShare / 100).toFixed(2)}, Savings +${(savingsShare / 100).toFixed(2)})`
        }
      });

      return w;
    });

    return res.json({
      success: true,
      message: `Successfully allocated ${(amountCents / 100).toFixed(2)} to ${recipient.fullName}`,
      balances: {
        everydayCents: updatedWallet.everydayCents,
        emergencyCents: updatedWallet.emergencyCents,
        savingsCents: updatedWallet.savingsCents
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to add funds" });
  }
});

walletRouter.post("/plan-split", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = PlanSplitSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid split percentages" });
    }

    const { everyday, emergency, savings } = parseResult.data;

    const updated = await db.plan.update({
      where: { userId: req.user!.id },
      data: {
        splitEveryday: everyday,
        splitEmergency: emergency,
        splitSavings: savings
      }
    });

    return res.json({
      success: true,
      split: {
        everyday: updated.splitEveryday,
        emergency: updated.splitEmergency,
        savings: updated.splitSavings
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update split" });
  }
});

walletRouter.post("/currency", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = CurrencySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid currency. Must be INR or USD" });
    }

    const updated = await db.user.update({
      where: { id: req.user!.id },
      data: { currency: parseResult.data.currency }
    });

    return res.json({
      success: true,
      currency: updated.currency,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update currency" });
  }
});
