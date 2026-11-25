import { Router, Response } from "express";
import { getPresetForAge, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { calculateGoalPacing, calculateEmergencyRunway } from "../utils/calculator";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      include: { wallet: true, plan: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const everydayCents = user.wallet?.everydayCents ?? 0;
    const emergencyCents = user.wallet?.emergencyCents ?? 0;
    const savingsCents = user.wallet?.savingsCents ?? 0;

    const splitEveryday = user.plan?.splitEveryday ?? 50;
    const splitEmergency = user.plan?.splitEmergency ?? 20;
    const splitSavings = user.plan?.splitSavings ?? 30;
    const monthlyExpensesCents = user.plan?.monthlyExpensesCents ?? 2000000;

    const goals = await db.goal.findMany({
      where: { userId: user.id, status: "active" }
    });

    const enrichedGoals = goals.map((g: any) => ({
      ...g,
      pacing: calculateGoalPacing(g)
    }));

    const runway = calculateEmergencyRunway(emergencyCents, monthlyExpensesCents);

    const incomingRequests = await db.request.findMany({
      where: {
        OR: [
          { parentId: user.id, status: "pending" },
          { partnerEmail: user.email.toLowerCase(), status: "pending" }
        ]
      }
    });

    const outgoingRequests = await db.request.findMany({
      where: { childId: user.id }
    });

    const recentTransactions = await db.transaction.findMany({
      where: { userId: user.id },
      take: 6
    });

    const badges = await db.badge.findMany({
      where: { userId: user.id }
    });

    const notifications = await db.notification.findMany({
      where: { userId: user.id }
    });

    const totalCents = everydayCents + emergencyCents + savingsCents;
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
        everydayCents,
        emergencyCents,
        savingsCents,
        totalCents
      },
      split: {
        everyday: splitEveryday,
        emergency: splitEmergency,
        savings: splitSavings,
        presetRecommendation: preset
      },
      runway,
      goals: enrichedGoals,
      approvals: {
        incoming: incomingRequests,
        outgoing: outgoingRequests
      },
      recentTransactions,
      badges,
      notifications,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});
