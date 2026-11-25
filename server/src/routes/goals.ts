import { Router, Response } from "express";
import {
  GoalCreateSchema,
  GoalDepositSchema,
  SimulateSpendSchema,
  GoalWithdrawSchema,
  DISCLAIMER
} from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { calculateGoalPacing, calculateEarlyWithdrawalDelay } from "../utils/calculator";

export const goalsRouter = Router();

// GET all goals for current user
goalsRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goals = await db.goal.findMany({
      where: { userId: req.user!.id }
    });

    const enriched = goals.map((g: any) => ({
      ...g,
      pacing: calculateGoalPacing(g)
    }));

    return res.json({ goals: enriched, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch goals" });
  }
});

// POST create a new goal
goalsRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = GoalCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || "Invalid goal data",
        details: parseResult.error.flatten()
      });
    }

    const input = parseResult.data;
    const targetCents = Math.round(input.targetAmount * 100);
    const autoSaveCents = input.autoSaveAmount ? Math.round(input.autoSaveAmount * 100) : 0;

    const goal = await db.goal.create({
      data: {
        userId: req.user!.id,
        name: input.name.trim(),
        category: input.category,
        targetCents,
        currentCents: 0,
        deadline: input.deadline,
        priority: input.priority,
        icon: input.icon || "🎯",
        autoSaveCents,
        autoSaveFrequency: input.autoSaveFrequency,
        roundUpEnabled: input.roundUpEnabled,
        status: "active"
      }
    });

    await db.appEvent.create({
      data: {
        userId: req.user!.id,
        action: "goal_created",
        details: `Created goal "${goal.name}" targeting ${goal.targetCents / 100} by ${goal.deadline}`
      }
    });

    return res.status(201).json({
      goal: {
        ...goal,
        pacing: calculateGoalPacing(goal)
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create goal" });
  }
});

// POST deposit into goal
goalsRouter.post("/:id/deposit", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    const goal = await db.goal.findUnique({ where: { id: goalId } });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const parseResult = GoalDepositSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid deposit amount" });
    }

    const depositCents = Math.round(parseResult.data.amount * 100);
    const user = await db.user.findUnique({ where: { id: req.user!.id } });

    if (!user || user.everydayCents < depositCents) {
      return res.status(400).json({ error: "Insufficient balance in Everyday wallet to complete this deposit." });
    }

    // Transfer from everyday to goal
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        everydayCents: { decrement: depositCents },
        savingsCents: { increment: depositCents }
      }
    });

    const updatedGoal = await db.goal.update({
      where: { id: goal.id },
      data: {
        currentCents: { increment: depositCents }
      }
    });

    // Check if goal reached 100%
    const pacing = calculateGoalPacing(updatedGoal);
    if (pacing.percent >= 100 && updatedGoal.status === "active") {
      await db.goal.update({
        where: { id: updatedGoal.id },
        data: { status: "completed" }
      });
      updatedGoal.status = "completed";
    }

    await db.transaction.create({
      data: {
        userId: user.id,
        type: "goal_deposit",
        amountCents: depositCents,
        note: `Deposit into goal: "${updatedGoal.name}"`
      }
    });

    await db.appEvent.create({
      data: {
        userId: user.id,
        action: "goal_deposit",
        details: `Saved ${depositCents / 100} to goal "${updatedGoal.name}". Progress: ${pacing.percent}%`
      }
    });

    return res.json({
      success: true,
      goal: {
        ...updatedGoal,
        pacing
      },
      userBalances: {
        everydayCents: updatedUser.everydayCents,
        savingsCents: updatedUser.savingsCents
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to make deposit" });
  }
});

// POST simulate spend and round-up micro-savings
goalsRouter.post("/:id/simulate-spend", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    const goal = await db.goal.findUnique({ where: { id: goalId } });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const parseResult = SimulateSpendSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid spend amount" });
    }

    const { spendAmount, note } = parseResult.data;
    const spendCents = Math.round(spendAmount * 100);

    // Round up calculation: round to the nearest whole rupee/dollar (100 cents)
    const remainder = spendCents % 100;
    const roundUpCents = remainder === 0 ? 0 : 100 - remainder;
    const totalDeductionCents = spendCents + roundUpCents;

    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user || user.everydayCents < totalDeductionCents) {
      return res.status(400).json({ error: "Insufficient Everyday balance for purchase and round-up." });
    }

    // Deduct total from everyday; add roundUpCents to savings and goal
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        everydayCents: { decrement: totalDeductionCents },
        savingsCents: { increment: roundUpCents }
      }
    });

    const updatedGoal = await db.goal.update({
      where: { id: goal.id },
      data: {
        currentCents: { increment: roundUpCents }
      }
    });

    await db.transaction.create({
      data: {
        userId: user.id,
        type: "card_purchase",
        amountCents: spendCents,
        note: `${note} (-${(spendCents / 100).toFixed(2)})`
      }
    });

    if (roundUpCents > 0) {
      await db.transaction.create({
        data: {
          userId: user.id,
          type: "round_up_save",
          amountCents: roundUpCents,
          note: `Spare change round-up into "${updatedGoal.name}" (+${(roundUpCents / 100).toFixed(2)})`
        }
      });
    }

    const pacing = calculateGoalPacing(updatedGoal);

    return res.json({
      success: true,
      spendAmount: spendCents / 100,
      roundUpAmount: roundUpCents / 100,
      goal: {
        ...updatedGoal,
        pacing
      },
      userBalances: {
        everydayCents: updatedUser.everydayCents,
        savingsCents: updatedUser.savingsCents
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to simulate spend" });
  }
});

// POST withdraw from goal (Completed vs Early Withdrawal)
goalsRouter.post("/:id/withdraw", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    const goal = await db.goal.findUnique({ where: { id: goalId } });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const parseResult = GoalWithdrawSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid withdrawal request" });
    }

    const { amount, reason } = parseResult.data;
    const withdrawCents = Math.round(amount * 100);

    if (withdrawCents > goal.currentCents) {
      return res.status(400).json({ error: "Withdrawal amount exceeds current goal savings." });
    }

    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isFullyCompleted = goal.currentCents >= goal.targetCents || goal.status === "completed";

    // 1. Fully Completed Goal: Instant payout!
    if (isFullyCompleted) {
      await db.user.update({
        where: { id: user.id },
        data: {
          everydayCents: { increment: withdrawCents },
          savingsCents: { decrement: withdrawCents }
        }
      });

      const updatedGoal = await db.goal.update({
        where: { id: goal.id },
        data: {
          currentCents: { decrement: withdrawCents },
          status: "completed"
        }
      });

      await db.transaction.create({
        data: {
          userId: user.id,
          type: "goal_completed_payout",
          amountCents: withdrawCents,
          note: `Payout from completed goal: "${goal.name}"`
        }
      });

      return res.json({
        status: "instant_completed",
        message: "🎉 Congratulations! Funds successfully transferred to your Everyday wallet.",
        goal: {
          ...updatedGoal,
          pacing: calculateGoalPacing(updatedGoal)
        },
        disclaimer: DISCLAIMER
      });
    }

    // 2. Early Withdrawal: Self-discipline lock & Approval logic
    const { delayDays, delayMessage } = calculateEarlyWithdrawalDelay(goal, withdrawCents);

    // A. Family Mode or Child role -> requires Parent approval
    if (user.accountMode === "FAMILY" || user.role === "CHILD") {
      const approval = await db.approval.create({
        data: {
          childId: user.id,
          parentId: user.parentId,
          amountCents: withdrawCents,
          reason,
          status: "pending",
          goalId: goal.id,
          coolingOff: false,
          delayDays,
          type: "early_goal_withdrawal"
        }
      });

      return res.json({
        status: "pending_parent_approval",
        message: "Early withdrawal request submitted to your parent for approval.",
        delayDays,
        delayMessage,
        approvalId: approval.id,
        disclaimer: DISCLAIMER
      });
    }

    // B. Teen / Student Mode with Accountability Partner -> partner approval
    if (user.accountMode === "TEEN" && user.accountabilityPartnerEmail) {
      const approval = await db.approval.create({
        data: {
          childId: user.id,
          partnerEmail: user.accountabilityPartnerEmail,
          amountCents: withdrawCents,
          reason,
          status: "pending",
          goalId: goal.id,
          coolingOff: false,
          delayDays,
          type: "early_goal_withdrawal"
        }
      });

      return res.json({
        status: "pending_partner_approval",
        message: `Early withdrawal request sent to accountability partner (${user.accountabilityPartnerEmail}) for verification.`,
        delayDays,
        delayMessage,
        approvalId: approval.id,
        disclaimer: DISCLAIMER
      });
    }

    // C. Myself Mode -> 24-hour self-discipline cooling-off period
    const now = new Date();
    const unlockAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const approval = await db.approval.create({
      data: {
        childId: user.id,
        amountCents: withdrawCents,
        reason,
        status: "cooling_off",
        goalId: goal.id,
        unlockAt,
        coolingOff: true,
        delayDays,
        type: "early_goal_withdrawal"
      }
    });

    return res.json({
      status: "cooling_off_initiated",
      message: "24-Hour Cooling-Off Period started to protect your goal commitment.",
      unlockAt: unlockAt.toISOString(),
      coolingOffRemainingMs: 24 * 60 * 60 * 1000,
      delayDays,
      delayMessage,
      approvalId: approval.id,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to process withdrawal" });
  }
});

// DELETE goal
goalsRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    const goal = await db.goal.findUnique({ where: { id: goalId } });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Refund any saved balance back to everyday
    if (goal.currentCents > 0) {
      await db.user.update({
        where: { id: req.user!.id },
        data: {
          everydayCents: { increment: goal.currentCents },
          savingsCents: { decrement: goal.currentCents }
        }
      });
    }

    await db.goal.delete({ where: { id: goalId } });

    return res.json({ success: true, message: "Goal deleted and funds refunded to Everyday wallet", disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to delete goal" });
  }
});
