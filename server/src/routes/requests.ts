import { Router, Response } from "express";
import { RequestCreateSchema, RequestReviewSchema, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { uploadSingle } from "../middleware/upload";
import { storageProvider } from "../utils/storage";

export const requestsRouter = Router();

// GET requests (incoming & outgoing)
requestsRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const incoming = await db.request.findMany({
      where: {
        OR: [
          { parentId: user.id, status: "pending" },
          { partnerEmail: user.email.toLowerCase(), status: "pending" }
        ]
      }
    });

    const outgoing = await db.request.findMany({
      where: { childId: user.id }
    });

    return res.json({ incoming, outgoing, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch requests" });
  }
});

// POST create a purchase or withdrawal request (with optional bill file upload)
requestsRouter.post("/", requireAuth, uploadSingle("bill"), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = RequestCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request payload" });
    }

    const { amount, reason, type, goalId } = parseResult.data;
    const amountCents = Math.round(amount * 100);
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    let billFile: string | null = null;
    if (req.file) {
      billFile = await storageProvider.saveFile(req.file);
    }

    const created = await db.request.create({
      data: {
        childId: user.id,
        parentId: user.parentId,
        partnerEmail: user.accountabilityPartnerEmail,
        amountCents,
        reason,
        billFile,
        type,
        goalId: goalId || null,
        status: "pending"
      }
    });

    if (user.parentId) {
      await db.notification.create({
        data: {
          userId: user.parentId,
          title: "New Request Pending",
          message: `${user.fullName} requested ${(amountCents / 100).toFixed(2)} for "${reason}".`
        }
      });
    }

    return res.status(201).json({ request: created, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create request" });
  }
});

// POST review request (Parent or Accountability Partner)
requestsRouter.post("/:id/review", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const parseResult = RequestReviewSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Decision must be 'approved' or 'declined'" });
    }

    const { decision } = parseResult.data;
    const requestRecord = await db.request.findUnique({ where: { id: requestId } });
    if (!requestRecord) {
      return res.status(404).json({ error: "Request not found" });
    }

    const reviewer = req.user!;
    const isParent = requestRecord.parentId === reviewer.id;
    const isPartner =
      requestRecord.partnerEmail &&
      requestRecord.partnerEmail.toLowerCase() === reviewer.email.toLowerCase();

    if (!isParent && !isPartner) {
      return res.status(403).json({ error: "You are not authorized to review this request." });
    }

    if (requestRecord.status !== "pending") {
      return res.status(400).json({ error: `Request already marked as ${requestRecord.status}` });
    }

    if (decision === "approved") {
      const updated = await db.$transaction(async (tx: any) => {
        if (requestRecord.type === "early_goal_withdrawal" && requestRecord.goalId) {
          const goal = await tx.goal.findUnique({ where: { id: requestRecord.goalId } });
          if (goal) {
            const withdrawCents = Math.min(requestRecord.amountCents, goal.currentCents);
            await tx.goal.update({
              where: { id: goal.id },
              data: { currentCents: { decrement: withdrawCents } }
            });

            await tx.wallet.update({
              where: { userId: requestRecord.childId },
              data: {
                everydayCents: { increment: withdrawCents },
                savingsCents: { decrement: withdrawCents }
              }
            });

            await tx.transaction.create({
              data: {
                userId: requestRecord.childId,
                walletType: "everyday",
                type: "approved_early_withdrawal",
                amountCents: withdrawCents,
                note: `Approved early withdrawal from "${goal.name}"`
              }
            });
          }
        } else if (requestRecord.type === "allowance") {
          await tx.wallet.update({
            where: { userId: requestRecord.childId },
            data: { everydayCents: { increment: requestRecord.amountCents } }
          });

          await tx.transaction.create({
            data: {
              userId: requestRecord.childId,
              walletType: "everyday",
              type: "allowance_approved",
              amountCents: requestRecord.amountCents,
              note: `Allowance approved: "${requestRecord.reason}"`
            }
          });
        } else if (requestRecord.type === "purchase_request") {
          const wallet = await tx.wallet.findUnique({ where: { userId: requestRecord.childId } });
          if (wallet && wallet.everydayCents >= requestRecord.amountCents) {
            await tx.wallet.update({
              where: { userId: requestRecord.childId },
              data: { everydayCents: { decrement: requestRecord.amountCents } }
            });
            await tx.transaction.create({
              data: {
                userId: requestRecord.childId,
                walletType: "everyday",
                type: "purchase_approved",
                amountCents: requestRecord.amountCents,
                note: `Purchase approved: "${requestRecord.reason}"`
              }
            });
          }
        }

        await tx.notification.create({
          data: {
            userId: requestRecord.childId,
            title: "Request Approved ✓",
            message: `Your request for ${(requestRecord.amountCents / 100).toFixed(2)} ("${requestRecord.reason}") was approved.`
          }
        });

        return tx.request.update({
          where: { id: requestRecord.id },
          data: {
            status: "approved",
            reviewedById: reviewer.id
          }
        });
      });

      return res.json({
        success: true,
        message: "Request approved and funds processed.",
        request: updated,
        disclaimer: DISCLAIMER
      });
    } else {
      const updated = await db.$transaction(async (tx: any) => {
        await tx.notification.create({
          data: {
            userId: requestRecord.childId,
            title: "Request Declined",
            message: `Your request for ${(requestRecord.amountCents / 100).toFixed(2)} ("${requestRecord.reason}") was declined.`
          }
        });

        return tx.request.update({
          where: { id: requestRecord.id },
          data: {
            status: "declined",
            reviewedById: reviewer.id
          }
        });
      });

      return res.json({
        success: true,
        message: "Request declined.",
        request: updated,
        disclaimer: DISCLAIMER
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to review request" });
  }
});

// POST finalize cooling-off for Individual accounts
requestsRouter.post("/:id/finalize-cooling-off", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { simulateBypass } = req.body;

    const requestRecord = await db.request.findUnique({ where: { id: requestId } });
    if (!requestRecord || requestRecord.childId !== req.user!.id) {
      return res.status(404).json({ error: "Cooling-off record not found" });
    }

    if (requestRecord.status !== "cooling_off") {
      return res.status(400).json({ error: `Request is not in cooling-off status (${requestRecord.status})` });
    }

    const now = new Date();
    const isUnlocked = requestRecord.unlockAt && new Date(requestRecord.unlockAt) <= now;

    if (!isUnlocked && !simulateBypass) {
      const remainingMs = Math.max(0, new Date(requestRecord.unlockAt!).getTime() - now.getTime());
      return res.status(400).json({
        error: "Cooling-off period is still active. Please wait for the timer to expire or test with simulateBypass: true.",
        remainingMs
      });
    }

    const updated = await db.$transaction(async (tx: any) => {
      if (requestRecord.goalId) {
        const goal = await tx.goal.findUnique({ where: { id: requestRecord.goalId } });
        if (goal) {
          const withdrawCents = Math.min(requestRecord.amountCents, goal.currentCents);
          await tx.goal.update({
            where: { id: goal.id },
            data: { currentCents: { decrement: withdrawCents } }
          });

          await tx.wallet.update({
            where: { userId: req.user!.id },
            data: {
              everydayCents: { increment: withdrawCents },
              savingsCents: { decrement: withdrawCents }
            }
          });

          await tx.transaction.create({
            data: {
              userId: req.user!.id,
              walletType: "everyday",
              type: "cooling_off_withdrawn",
              amountCents: withdrawCents,
              note: `Cooling-off completed: Withdrew from "${goal.name}"`
            }
          });
        }
      }

      return tx.request.update({
        where: { id: requestRecord.id },
        data: { status: "completed" }
      });
    });

    return res.json({
      success: true,
      message: "Cooling-off period complete. Funds moved to Everyday wallet.",
      request: updated,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to finalize cooling-off" });
  }
});
