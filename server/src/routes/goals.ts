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

goalsRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goals = await db.goal.findMany({ where: { userId: req.user!.id } });
    const enriched = goals.map((g: any) => ({
      ...g,
      pacing: calculateGoalPacing(g)
    }));
    return res.json({ goals: enriched, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch goals" });
  }
});

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

    return res.status(201).json({
      goal: { ...goal, pacing: calculateGoalPacing(goal) },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create goal" });
  }
});

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
    const wallet = await db.wallet.findUnique({ where: { userId: req.user!.id } });

    if (!wallet || wallet.everydayCents < depositCents) {
      return res.status(400).json({ error: "Insufficient balance in Everyday wallet to complete this deposit." });
    }

    const result = await db.$transaction(async (tx: any) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: req.user!.id },
        data: {
          everydayCents: { decrement: depositCents },
          savingsCents: { increment: depositCents }
        }
      });

      let updatedGoal = await tx.goal.update({
        where: { id: goal.id },
        data: { currentCents: { increment: depositCents } }
      });

      const pacing = calculateGoalPacing(updatedGoal);
      if (pacing.percent >= 100 && updatedGoal.status === "active") {
        updatedGoal = await tx.goal.update({
          where: { id: updatedGoal.id },
          data: { status: "completed" }
        });
        await tx.badge.upsert({
          where: { userId_name: { userId: req.user!.id, name: `Achieved: ${updatedGoal.name}` } },
          update: {},
          create: {
            userId: req.user!.id,
            name: `Achieved: ${updatedGoal.name}`,
            description: `Reached 100% of goal ${updatedGoal.name}`,
            icon: "🏆"
          }
        });
      }

      await tx.goalDeposit.create({
        data: {
          goalId: updatedGoal.id,
          userId: req.user!.id,
          amountCents: depositCents,
          note: `Manual deposit to "${updatedGoal.name}"`
        }
      });

      await tx.transaction.create({
        data: {
          userId: req.user!.id,
          walletType: "savings",
          type: "goal_deposit",
          amountCents: depositCents,
          note: `Deposit into goal: "${updatedGoal.name}"`
        }
      });

      return { updatedWallet, updatedGoal, pacing };
    });

    return res.json({
      success: true,
      goal: { ...result.updatedGoal, pacing: result.pacing },
      userBalances: {
        everydayCents: result.updatedWallet.everydayCents,
        savingsCents: result.updatedWallet.savingsCents
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to make deposit" });
  }
});

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
    const remainder = spendCents % 100;
    const roundUpCents = remainder === 0 ? 0 : 100 - remainder;
    const totalDeductionCents = spendCents + roundUpCents;

    const wallet = await db.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet || wallet.everydayCents < totalDeductionCents) {
      return res.status(400).json({ error: "Insufficient Everyday balance for purchase and round-up." });
    }

    const result = await db.$transaction(async (tx: any) => {
      const updatedWallet = await tx.wallet.update({
        where: { userId: req.user!.id },
        data: {
          everydayCents: { decrement: totalDeductionCents },
          savingsCents: { increment: roundUpCents }
        }
      });

      const updatedGoal = await tx.goal.update({
        where: { id: goal.id },
        data: { currentCents: { increment: roundUpCents } }
      });

      await tx.transaction.create({
        data: {
          userId: req.user!.id,
          walletType: "everyday",
          type: "card_purchase",
          amountCents: spendCents,
          note: `${note} (-${(spendCents / 100).toFixed(2)})`
        }
      });

      if (roundUpCents > 0) {
        await tx.goalDeposit.create({
          data: {
            goalId: updatedGoal.id,
            userId: req.user!.id,
            amountCents: roundUpCents,
            note: `Round-up from "${note}"`
          }
        });

        await tx.transaction.create({
          data: {
            userId: req.user!.id,
            walletType: "savings",
            type: "round_up_save",
            amountCents: roundUpCents,
            note: `Spare change round-up into "${updatedGoal.name}" (+${(roundUpCents / 100).toFixed(2)})`
          }
        });
      }

      return { updatedWallet, updatedGoal };
    });

    const pacing = calculateGoalPacing(result.updatedGoal);

    return res.json({
      success: true,
      spendAmount: spendCents / 100,
      roundUpAmount: roundUpCents / 100,
      goal: { ...result.updatedGoal, pacing },
      userBalances: {
        everydayCents: result.updatedWallet.everydayCents,
        savingsCents: result.updatedWallet.savingsCents
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to simulate spend" });
  }
});

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

    if (isFullyCompleted) {
      const updatedGoal = await db.$transaction(async (tx: any) => {
        await tx.wallet.update({
          where: { userId: user.id },
          data: {
            everydayCents: { increment: withdrawCents },
            savingsCents: { decrement: withdrawCents }
          }
        });

        const g = await tx.goal.update({
          where: { id: goal.id },
          data: { currentCents: { decrement: withdrawCents }, status: "completed" }
        });

        await tx.transaction.create({
          data: {
            userId: user.id,
            walletType: "everyday",
            type: "goal_completed_payout",
            amountCents: withdrawCents,
            note: `Payout from completed goal: "${goal.name}"`
          }
        });

        return g;
      });

      return res.json({
        status: "instant_completed",
        message: "🎉 Congratulations! Funds successfully transferred to your Everyday wallet.",
        goal: { ...updatedGoal, pacing: calculateGoalPacing(updatedGoal) },
        disclaimer: DISCLAIMER
      });
    }

    const { delayDays, delayMessage } = calculateEarlyWithdrawalDelay(goal, withdrawCents);

    if (user.accountMode === "FAMILY" || user.role === "CHILD") {
      const reqRecord = await db.request.create({
        data: {
          childId: user.id,
          parentId: user.parentId,
          amountCents: withdrawCents,
          reason,
          status: "pending",
          goalId: goal.id,
          delayDays,
          type: "early_goal_withdrawal"
        }
      });

      return res.json({
        status: "pending_parent_approval",
        message: "Early withdrawal request submitted to your parent for approval.",
        delayDays,
        delayMessage,
        requestId: reqRecord.id,
        approvalId: reqRecord.id,
        disclaimer: DISCLAIMER
      });
    }

    if (user.accountMode === "TEEN" && user.accountabilityPartnerEmail) {
      const reqRecord = await db.request.create({
        data: {
          childId: user.id,
          partnerEmail: user.accountabilityPartnerEmail,
          amountCents: withdrawCents,
          reason,
          status: "pending",
          goalId: goal.id,
          delayDays,
          type: "early_goal_withdrawal"
        }
      });

      return res.json({
        status: "pending_partner_approval",
        message: `Early withdrawal request sent to accountability partner (${user.accountabilityPartnerEmail}) for verification.`,
        delayDays,
        delayMessage,
        requestId: reqRecord.id,
        approvalId: reqRecord.id,
        disclaimer: DISCLAIMER
      });
    }

    const unlockAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const reqRecord = await db.request.create({
      data: {
        childId: user.id,
        amountCents: withdrawCents,
        reason,
        status: "cooling_off",
        goalId: goal.id,
        unlockAt,
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
      requestId: reqRecord.id,
      approvalId: reqRecord.id,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to process withdrawal" });
  }
});

goalsRouter.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    const goal = await db.goal.findUnique({ where: { id: goalId } });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ error: "Goal not found" });
    }

    await db.$transaction(async (tx: any) => {
      if (goal.currentCents > 0) {
        await tx.wallet.update({
          where: { userId: req.user!.id },
          data: {
            everydayCents: { increment: goal.currentCents },
            savingsCents: { decrement: goal.currentCents }
          }
        });

        await tx.transaction.create({
          data: {
            userId: req.user!.id,
            walletType: "everyday",
            type: "goal_cancelled_refund",
            amountCents: goal.currentCents,
            note: `Refund from deleted goal: "${goal.name}"`
          }
        });
      }

      await tx.goal.delete({ where: { id: goalId } });
    });

    return res.json({ success: true, message: "Goal deleted and funds refunded to Everyday wallet", disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to delete goal" });
  }
});
