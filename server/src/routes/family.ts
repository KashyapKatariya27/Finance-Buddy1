import { Router, Response } from "express";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { DISCLAIMER } from "@finance-buddy/shared";

export const familyRouter = Router();

// GET children for parent account
familyRouter.get("/children", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parent = req.user!;
    if (parent.role !== "PARENT") {
      return res.status(403).json({ error: "Only parent accounts can manage family children." });
    }

    const children = await db.user.findMany({
      where: { parentId: parent.id }
    });

    const enrichedChildren = await Promise.all(
      children.map(async (child: any) => {
        const goals = await db.goal.findMany({ where: { userId: child.id, status: "active" } });
        return {
          id: child.id,
          fullName: child.fullName,
          email: child.email,
          age: child.age,
          currency: child.currency,
          everydayCents: child.everydayCents,
          emergencyCents: child.emergencyCents,
          savingsCents: child.savingsCents,
          split: {
            everyday: child.splitEveryday,
            emergency: child.splitEmergency,
            savings: child.splitSavings
          },
          goalsCount: goals.length,
          streakDays: child.streakDays
        };
      })
    );

    return res.json({ children: enrichedChildren, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load children" });
  }
});

// POST allocate funds to a child (or self) with auto-split
familyRouter.post("/funds", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, amount } = req.body;
    const amountCents = Math.round(Number(amount) * 100);

    if (isNaN(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const recipientId = targetUserId ? parseInt(targetUserId, 10) : req.user!.id;
    const recipient = await db.user.findUnique({ where: { id: recipientId } });

    if (!recipient) {
      return res.status(404).json({ error: "Recipient user not found" });
    }

    // Authorization check
    if (recipientId !== req.user!.id && recipient.parentId !== req.user!.id) {
      return res.status(403).json({ error: "You are not authorized to fund this account" });
    }

    // Split according to recipient's plan split
    const everydayShare = Math.round((amountCents * recipient.splitEveryday) / 100);
    const emergencyShare = Math.round((amountCents * recipient.splitEmergency) / 100);
    const savingsShare = amountCents - everydayShare - emergencyShare;

    const updated = await db.user.update({
      where: { id: recipient.id },
      data: {
        everydayCents: { increment: everydayShare },
        emergencyCents: { increment: emergencyShare },
        savingsCents: { increment: savingsShare }
      }
    });

    await db.transaction.create({
      data: {
        userId: recipient.id,
        type: "fund_allocation",
        amountCents,
        note: `Fund allocation from ${req.user!.fullName} (Everyday: +${(everydayShare / 100).toFixed(2)}, Emergency: +${(emergencyShare / 100).toFixed(2)}, Savings: +${(savingsShare / 100).toFixed(2)})`
      }
    });

    return res.json({
      success: true,
      message: `Successfully allocated ${(amountCents / 100).toFixed(2)} to ${recipient.fullName}`,
      balances: {
        everydayCents: updated.everydayCents,
        emergencyCents: updated.emergencyCents,
        savingsCents: updated.savingsCents
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to add funds" });
  }
});

// GET all transactions
familyRouter.get("/transactions", requireAuth, async (req: AuthRequest, res: Response) => {
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

// GET events
familyRouter.get("/events", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const events = await db.appEvent.findMany({
      where: { userId: req.user!.id },
      take: 25
    });

    return res.json({ events, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load events" });
  }
});
