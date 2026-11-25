import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { getPresetForAge, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const childrenRouter = Router();

// GET children linked to the logged-in parent
childrenRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parent = req.user!;
    if (parent.role !== "PARENT") {
      return res.status(403).json({ error: "Only parent accounts can access family children." });
    }

    const children = await db.user.findMany({
      where: { parentId: parent.id },
      include: { wallet: true, plan: true }
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
          everydayCents: child.wallet?.everydayCents ?? 0,
          emergencyCents: child.wallet?.emergencyCents ?? 0,
          savingsCents: child.wallet?.savingsCents ?? 0,
          split: {
            everyday: child.plan?.splitEveryday ?? 50,
            emergency: child.plan?.splitEmergency ?? 20,
            savings: child.plan?.splitSavings ?? 30
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

// POST parent creates a new child account
childrenRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parent = req.user!;
    if (parent.role !== "PARENT") {
      return res.status(403).json({ error: "Only parent accounts can create child accounts." });
    }

    const { fullName, email, password, age = 10, currency } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Full name, email, and password are required." });
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const preset = getPresetForAge(Number(age));
    const passwordHash = await bcrypt.hash(password, 10);

    const child = await db.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          passwordHash,
          role: "CHILD",
          accountMode: "FAMILY",
          age: Number(age),
          currency: currency || parent.currency || "INR",
          parentId: parent.id,
          streakDays: 1,
          wallet: {
            create: {
              everydayCents: 0,
              emergencyCents: 0,
              savingsCents: 0
            }
          },
          plan: {
            create: {
              splitEveryday: preset.everyday,
              splitEmergency: preset.emergency,
              splitSavings: preset.savings,
              monthlyExpensesCents: 50000
            }
          }
        }
      });

      await tx.notification.create({
        data: {
          userId: created.id,
          title: "Account Created!",
          message: `Welcome ${created.fullName}! Your parent ${parent.fullName} set up your FinanceBuddy account.`
        }
      });

      return created;
    });

    return res.status(201).json({
      child: {
        id: child.id,
        fullName: child.fullName,
        email: child.email,
        age: child.age,
        role: child.role,
        currency: child.currency
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create child account" });
  }
});
