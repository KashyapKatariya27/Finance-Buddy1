import { Router, Response } from "express";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { DISCLAIMER } from "@finance-buddy/shared";

export const approvalsRouter = Router();

// GET pending approvals relevant to user (incoming & outgoing)
approvalsRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const incoming = await db.approval.findMany({
      where: {
        OR: [
          { parentId: user.id, status: "pending" },
          { partnerEmail: user.email.toLowerCase(), status: "pending" }
        ]
      }
    });

    const outgoing = await db.approval.findMany({
      where: { childId: user.id }
    });

    return res.json({ incoming, outgoing, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch approvals" });
  }
});

// POST review approval (Parent or Accountability Partner)
approvalsRouter.post("/:id/review", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const approvalId = parseInt(req.params.id, 10);
    const { decision } = req.body; // "approved" | "rejected"

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'" });
    }

    const approval = await db.approval.findUnique({ where: { id: approvalId } });
    if (!approval) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const reviewer = req.user!;
    const isParent = approval.parentId === reviewer.id;
    const isPartner = approval.partnerEmail && approval.partnerEmail.toLowerCase() === reviewer.email.toLowerCase();

    if (!isParent && !isPartner) {
      return res.status(403).json({ error: "You are not authorized to review this request." });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({ error: `Request already marked as ${approval.status}` });
    }

    if (decision === "approved") {
      // Execute fund movement if it's an early goal withdrawal
      if (approval.type === "early_goal_withdrawal" && approval.goalId) {
        const goal = await db.goal.findUnique({ where: { id: approval.goalId } });
        if (goal) {
          const withdrawCents = Math.min(approval.amountCents, goal.currentCents);
          await db.goal.update({
            where: { id: goal.id },
            data: { currentCents: { decrement: withdrawCents } }
          });

          await db.user.update({
            where: { id: approval.childId },
            data: {
              everydayCents: { increment: withdrawCents },
              savingsCents: { decrement: withdrawCents }
            }
          });

          await db.transaction.create({
            data: {
              userId: approval.childId,
              type: "approved_early_withdrawal",
              amountCents: withdrawCents,
              note: `Approved early withdrawal from "${goal.name}"`
            }
          });
        }
      }

      const updated = await db.approval.update({
        where: { id: approval.id },
        data: {
          status: "approved",
          reviewedById: reviewer.id
        }
      });

      return res.json({
        success: true,
        message: "Request approved and funds disbursed.",
        approval: updated,
        disclaimer: DISCLAIMER
      });
    } else {
      const updated = await db.approval.update({
        where: { id: approval.id },
        data: {
          status: "rejected",
          reviewedById: reviewer.id
        }
      });

      return res.json({
        success: true,
        message: "Request rejected.",
        approval: updated,
        disclaimer: DISCLAIMER
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to review approval" });
  }
});

// POST finalize cooling-off for Individual accounts
approvalsRouter.post("/:id/finalize-cooling-off", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const approvalId = parseInt(req.params.id, 10);
    const { simulateBypass } = req.body;

    const approval = await db.approval.findUnique({ where: { id: approvalId } });
    if (!approval || approval.childId !== req.user!.id) {
      return res.status(404).json({ error: "Cooling-off record not found" });
    }

    if (approval.status !== "cooling_off") {
      return res.status(400).json({ error: `Request is not in cooling-off status (${approval.status})` });
    }

    const now = new Date();
    const isUnlocked = approval.unlockAt && new Date(approval.unlockAt) <= now;

    if (!isUnlocked && !simulateBypass) {
      const remainingMs = Math.max(0, new Date(approval.unlockAt!).getTime() - now.getTime());
      return res.status(400).json({
        error: "Cooling-off period is still active. Please wait for the timer to expire or test with simulateBypass: true.",
        remainingMs
      });
    }

    // Release funds
    if (approval.goalId) {
      const goal = await db.goal.findUnique({ where: { id: approval.goalId } });
      if (goal) {
        const withdrawCents = Math.min(approval.amountCents, goal.currentCents);
        await db.goal.update({
          where: { id: goal.id },
          data: { currentCents: { decrement: withdrawCents } }
        });

        await db.user.update({
          where: { id: req.user!.id },
          data: {
            everydayCents: { increment: withdrawCents },
            savingsCents: { decrement: withdrawCents }
          }
        });

        await db.transaction.create({
          data: {
            userId: req.user!.id,
            type: "cooling_off_withdrawn",
            amountCents: withdrawCents,
            note: `Cooling-off completed: Withdrew from "${goal.name}"`
          }
        });
      }
    }

    const updated = await db.approval.update({
      where: { id: approval.id },
      data: { status: "completed" }
    });

    return res.json({
      success: true,
      message: "Cooling-off period complete. Funds moved to Everyday wallet.",
      approval: updated,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to finalize cooling-off" });
  }
});
