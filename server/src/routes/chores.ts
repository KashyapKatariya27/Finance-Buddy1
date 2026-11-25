import { Router, Response } from "express";
import { ChoreCreateSchema, ChoreSubmitSchema, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { uploadSingle } from "../middleware/upload";
import { storageProvider } from "../utils/storage";

export const choresRouter = Router();

// GET chores (scoped to parent or child)
choresRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let chores: any[] = [];

    if (user.role === "PARENT") {
      chores = await db.chore.findMany({
        where: { parentId: user.id },
        include: { submissions: true }
      });
    } else if (user.role === "CHILD") {
      chores = await db.chore.findMany({
        where: { childId: user.id },
        include: { submissions: true }
      });
    }

    return res.json({ chores, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch chores" });
  }
});

// POST parent creates chore for their child
choresRouter.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parent = req.user!;
    if (parent.role !== "PARENT") {
      return res.status(403).json({ error: "Only parents can assign chores." });
    }

    const parseResult = ChoreCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid chore data" });
    }

    const { title, description, rewardAmount, dueDate, childId } = parseResult.data;

    // Server-side permission check: verify child belongs to parent
    const child = await db.user.findUnique({ where: { id: childId } });
    if (!child || child.parentId !== parent.id) {
      return res.status(403).json({ error: "You can only assign chores to your own children." });
    }

    const rewardCents = Math.round(rewardAmount * 100);
    const chore = await db.chore.create({
      data: {
        parentId: parent.id,
        childId,
        title: title.trim(),
        description: description.trim(),
        rewardCents,
        dueDate: dueDate || null,
        status: "pending"
      }
    });

    await db.notification.create({
      data: {
        userId: childId,
        title: "New Chore Assigned!",
        message: `${parent.fullName} assigned "${chore.title}" for a reward of ${(rewardCents / 100).toFixed(2)}.`
      }
    });

    return res.status(201).json({ chore, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create chore" });
  }
});

// POST child submits chore completion (optional proof file)
choresRouter.post("/:id/submit", requireAuth, uploadSingle("proof"), async (req: AuthRequest, res: Response) => {
  try {
    const choreId = parseInt(req.params.id, 10);
    const chore = await db.chore.findUnique({ where: { id: choreId } });

    if (!chore || chore.childId !== req.user!.id) {
      return res.status(404).json({ error: "Chore not found or not assigned to you." });
    }

    const parseResult = ChoreSubmitSchema.safeParse(req.body);
    const note = parseResult.success ? parseResult.data.note : "";

    let fileUrl: string | null = null;
    if (req.file) {
      fileUrl = await storageProvider.saveFile(req.file);
    }

    const updatedChore = await db.$transaction(async (tx: any) => {
      await tx.choreSubmission.create({
        data: {
          choreId: chore.id,
          childId: req.user!.id,
          note,
          fileUrl
        }
      });

      return tx.chore.update({
        where: { id: chore.id },
        data: { status: "submitted" }
      });
    });

    return res.json({ success: true, chore: updatedChore, disclaimer: DISCLAIMER });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to submit chore" });
  }
});

// POST parent approves or rejects chore
choresRouter.post("/:id/review", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const choreId = parseInt(req.params.id, 10);
    const { decision } = req.body; // "approved" | "rejected"

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'" });
    }

    const chore = await db.chore.findUnique({ where: { id: choreId } });
    if (!chore || chore.parentId !== req.user!.id) {
      return res.status(403).json({ error: "Chore not found or unauthorized." });
    }

    if (chore.status === "approved") {
      return res.status(400).json({ error: "Chore reward already paid." });
    }

    if (decision === "approved") {
      const updated = await db.$transaction(async (tx: any) => {
        const ch = await tx.chore.update({
          where: { id: chore.id },
          data: { status: "approved" }
        });

        await tx.wallet.update({
          where: { userId: chore.childId },
          data: { everydayCents: { increment: chore.rewardCents } }
        });

        await tx.transaction.create({
          data: {
            userId: chore.childId,
            walletType: "everyday",
            type: "chore_reward",
            amountCents: chore.rewardCents,
            note: `Chore reward approved: "${chore.title}"`
          }
        });

        await tx.notification.create({
          data: {
            userId: chore.childId,
            title: "Chore Approved! 🎉",
            message: `You earned ${(chore.rewardCents / 100).toFixed(2)} for completing "${chore.title}"!`
          }
        });

        return ch;
      });

      return res.json({ success: true, chore: updated, disclaimer: DISCLAIMER });
    } else {
      const updated = await db.chore.update({
        where: { id: chore.id },
        data: { status: "rejected" }
      });

      return res.json({ success: true, chore: updated, disclaimer: DISCLAIMER });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to review chore" });
  }
});
