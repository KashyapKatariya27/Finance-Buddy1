import { Router, Response } from "express";
import { PlanSplitSchema, CurrencySchema, getPresetForAge, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { calculateGoalPacing, calculateEmergencyRunway } from "../utils/calculator";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Active goals
    const goals = await db.goal.findMany({
      where: { userId: user.id, status: "active" }
    });

    const enrichedGoals = goals.map((g: any) => ({
      ...g,
      pacing: calculateGoalPacing(g)
    }));

    // Emergency runway
    const runway = calculateEmergencyRunway(user.emergencyCents, user.monthlyExpensesCents);

    // Incoming approvals (if this user is a parent or an accountability partner)
    const incomingApprovals = await db.approval.findMany({
      where: {
        OR: [
          { parentId: user.id, status: "pending" },
          { partnerEmail: user.email.toLowerCase(), status: "pending" }
        ]
      }
    });

    // Outgoing approvals or cooling-off locks
    const outgoingApprovals = await db.approval.findMany({
      where: {
        childId: user.id
      }
    });

    // Recent transactions
    const recentTransactions = await db.transaction.findMany({
      where: { userId: user.id },
      take: 6
    });

    const totalCents = user.everydayCents + user.emergencyCents + user.savingsCents;
    const preset = getPresetForAge(user.age);

    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountMode: user.accountMode,
        age: user.age,
        currency: user.currency,
        streakDays: user.streakDays
      },
      balances: {
        everydayCents: user.everydayCents,
        emergencyCents: user.emergencyCents,
        savingsCents: user.savingsCents,
        totalCents
      },
      split: {
        everyday: user.splitEveryday,
        emergency: user.splitEmergency,
        savings: user.splitSavings,
        presetRecommendation: preset
      },
      runway,
      goals: enrichedGoals,
      approvals: {
        incoming: incomingApprovals,
        outgoing: outgoingApprovals
      },
      recentTransactions,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});

dashboardRouter.post("/plan-split", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = PlanSplitSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid split percentages" });
    }

    const { everyday, emergency, savings } = parseResult.data;

    const updated = await db.user.update({
      where: { id: req.user!.id },
      data: {
        splitEveryday: everyday,
        splitEmergency: emergency,
        splitSavings: savings
      }
    });

    await db.appEvent.create({
      data: {
        userId: req.user!.id,
        action: "plan_split_updated",
        details: `Updated plan split to ${everyday}% Everyday, ${emergency}% Emergency, ${savings}% Savings`
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

dashboardRouter.post("/currency", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = CurrencySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid currency. Must be INR or USD" });
    }

    const { currency } = parseResult.data;

    const updated = await db.user.update({
      where: { id: req.user!.id },
      data: { currency }
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
