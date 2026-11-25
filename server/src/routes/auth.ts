import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { RegisterSchema, LoginSchema, getPresetForAge, DISCLAIMER } from "@finance-buddy/shared";
import db from "../db";
import { signToken, setAuthCookie, clearAuthCookie, requireAuth, AuthRequest } from "../middleware/auth";
import { loginRateLimiter } from "../middleware/rateLimit";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || "Invalid registration data",
        details: parseResult.error.flatten()
      });
    }

    const input = parseResult.data;

    if (input.accountMode === "MYSELF" && input.age < 18) {
      return res.status(400).json({
        error: "Children under 18 must use a Family or Teen account guided by a guardian."
      });
    }

    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    let finalRole: "PARENT" | "CHILD" | "INDIVIDUAL" = input.role;
    if (input.accountMode === "MYSELF") {
      finalRole = "INDIVIDUAL";
    } else if (input.accountMode === "TEEN") {
      finalRole = input.age < 18 ? "CHILD" : "INDIVIDUAL";
    } else if (input.accountMode === "FAMILY" && !input.role) {
      finalRole = input.age < 18 ? "CHILD" : "PARENT";
    }

    let parentId: number | null = null;
    if (input.parentEmail) {
      const parentUser = await db.user.findUnique({ where: { email: input.parentEmail } });
      if (parentUser) parentId = parentUser.id;
    }

    const preset = getPresetForAge(input.age);
    const passwordHash = await bcrypt.hash(input.password, 10);

    const newUser = await db.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash,
          role: finalRole,
          accountMode: input.accountMode,
          age: input.age,
          currency: input.currency || "INR",
          parentId,
          accountabilityPartnerEmail: input.accountabilityPartnerEmail?.trim().toLowerCase() || null,
          streakDays: 1,
          wallet: {
            create: {
              everydayCents: 500000, // Demo starting fund: 5,000.00
              emergencyCents: 200000, // Demo starting fund: 2,000.00
              savingsCents: 300000 // Demo starting fund: 3,000.00
            }
          },
          plan: {
            create: {
              splitEveryday: preset.everyday,
              splitEmergency: preset.emergency,
              splitSavings: preset.savings,
              monthlyExpensesCents: 2000000
            }
          }
        }
      });

      await tx.transaction.create({
        data: {
          userId: created.id,
          walletType: "everyday",
          type: "initial_deposit",
          amountCents: 1000000,
          note: `Welcome bonus split (${preset.everyday}% Everyday, ${preset.emergency}% Emergency, ${preset.savings}% Savings)`
        }
      });

      await tx.notification.create({
        data: {
          userId: created.id,
          title: "Welcome to FinanceBuddy!",
          message: "Your Goal-First financial workspace is ready. Start by setting your first goal."
        }
      });

      return created;
    });

    const token = signToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        accountMode: newUser.accountMode,
        age: newUser.age,
        currency: newUser.currency,
        parentId: newUser.parentId,
        accountabilityPartnerEmail: newUser.accountabilityPartnerEmail,
        split: {
          everyday: preset.everyday,
          emergency: preset.emergency,
          savings: preset.savings
        }
      },
      token,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return res.status(500).json({ error: error.message || "Registration failed" });
  }
});

authRouter.post("/login", loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const { email, password } = parseResult.data;
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { wallet: true, plan: true }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountMode: user.accountMode,
        age: user.age,
        currency: user.currency,
        parentId: user.parentId,
        accountabilityPartnerEmail: user.accountabilityPartnerEmail,
        split: {
          everyday: user.plan?.splitEveryday ?? 50,
          emergency: user.plan?.splitEmergency ?? 20,
          savings: user.plan?.splitSavings ?? 30
        }
      },
      token,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: error.message || "Login failed" });
  }
});

authRouter.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookie(res);
  return res.json({ success: true, message: "Logged out successfully" });
});

authRouter.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      include: { wallet: true, plan: true }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountMode: user.accountMode,
        age: user.age,
        currency: user.currency,
        parentId: user.parentId,
        accountabilityPartnerEmail: user.accountabilityPartnerEmail,
        everydayCents: user.wallet?.everydayCents ?? 0,
        emergencyCents: user.wallet?.emergencyCents ?? 0,
        savingsCents: user.wallet?.savingsCents ?? 0,
        splitEveryday: user.plan?.splitEveryday ?? 50,
        splitEmergency: user.plan?.splitEmergency ?? 20,
        splitSavings: user.plan?.splitSavings ?? 30,
        streakDays: user.streakDays
      },
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load user" });
  }
});
