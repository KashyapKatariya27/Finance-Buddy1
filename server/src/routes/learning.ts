import { Router, Response } from "express";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { DISCLAIMER } from "@finance-buddy/shared";

export const learningRouter = Router();

export interface LessonModule {
  id: string;
  level: "Kids" | "Teens" | "Adults";
  title: string;
  summary: string;
  durationMinutes: number;
  rewardCents: number;
  category: string;
  icon: string;
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export const MODULES: LessonModule[] = [
  {
    id: "kids-1",
    level: "Kids",
    title: "Needs vs Wants Magic",
    summary: "Discover why food and shoes are Needs, while candy and video games are Wants!",
    durationMinutes: 3,
    rewardCents: 5000,
    category: "Basics",
    icon: "🪄",
    quiz: {
      question: "Which of the following is a 'Need'?",
      options: ["A new superhero toy", "School lunch and water", "An ice cream cone", "A video game skin"],
      correctIndex: 1,
      explanation: "Water and nutritious food are basic essentials we need every day to thrive!"
    }
  },
  {
    id: "kids-2",
    level: "Kids",
    title: "The 3 Piggy Banks Rule",
    summary: "Divide your money into Spend, Save, and Give jars to watch your dreams grow.",
    durationMinutes: 4,
    rewardCents: 5000,
    category: "Saving",
    icon: "🐷",
    quiz: {
      question: "What is the 'Save' jar best used for?",
      options: ["Spending right this second", "Buying bigger goals in the future", "Losing coins under the couch", "Throwing away"],
      correctIndex: 1,
      explanation: "The Save jar lets your money wait until you have enough for your biggest dreams!"
    }
  },
  {
    id: "teens-1",
    level: "Teens",
    title: "The 50/30/20 Rule for Students",
    summary: "Balance your pocket money: 50% essentials, 30% fun, 20% future investments.",
    durationMinutes: 5,
    rewardCents: 10000,
    category: "Budgeting",
    icon: "📊",
    quiz: {
      question: "If you receive ₹1,000 allowance, how much goes into your Savings goal under 50/30/20?",
      options: ["₹500", "₹300", "₹200", "₹0"],
      correctIndex: 2,
      explanation: "20% of ₹1,000 is ₹200 dedicated directly to your future savings!"
    }
  },
  {
    id: "teens-2",
    level: "Teens",
    title: "Spotting Phishing & Online Scams",
    summary: "Never share OTPs, passwords, or click suspicious links claiming you won a lottery.",
    durationMinutes: 5,
    rewardCents: 10000,
    category: "Security",
    icon: "🛡️",
    quiz: {
      question: "A text message says you won ₹50,000 and asks for your bank OTP. What should you do?",
      options: ["Send the OTP immediately", "Delete and report the message as a scam", "Forward to all your friends", "Call the unknown sender"],
      correctIndex: 1,
      explanation: "Banks and legitimate services NEVER ask for your private OTP or passwords!"
    }
  },
  {
    id: "adults-1",
    level: "Adults",
    title: "Emergency Vault: 3-6 Months Runway",
    summary: "Why an untouchable cash cushion protects your investments and mental peace against unexpected life events.",
    durationMinutes: 6,
    rewardCents: 15000,
    category: "Emergency Funds",
    icon: "🏦",
    quiz: {
      question: "If your essential living expenses are ₹30,000/month, how much is an adequate 3-month emergency fund?",
      options: ["₹30,000", "₹60,000", "₹90,000", "₹180,000"],
      correctIndex: 2,
      explanation: "3 months × ₹30,000/month = ₹90,000 liquid emergency reserve."
    }
  },
  {
    id: "adults-2",
    level: "Adults",
    title: "Systematic Investment Plans (SIP) & Compounding",
    summary: "How regular monthly investments harness the power of exponential compounding over 10-20 years.",
    durationMinutes: 7,
    rewardCents: 15000,
    category: "Wealth Building",
    icon: "📈",
    quiz: {
      question: "What is the primary advantage of a monthly SIP over trying to time the market?",
      options: ["Rupee cost averaging and disciplined compounding", "Guaranteed 100% returns tomorrow", "Zero market volatility", "No need to budget"],
      correctIndex: 0,
      explanation: "SIP removes emotional market timing and buys more units during market dips."
    }
  },
  {
    id: "adults-3",
    level: "Adults",
    title: "Smart Debt & Credit Score Hygiene",
    summary: "Distinguish productive low-cost leverage from high-interest debt traps and maintain a 750+ credit score.",
    durationMinutes: 6,
    rewardCents: 15000,
    category: "Debt Management",
    icon: "💳",
    quiz: {
      question: "Which habit is best for building an excellent credit score?",
      options: ["Paying minimum due on credit cards", "Paying full statement balance on time every cycle", "Maxing out all credit cards", "Closing all old bank accounts"],
      correctIndex: 1,
      explanation: "Paying your statement in full avoids astronomical 36-42% APR interest charges and shows stellar creditworthiness."
    }
  }
];

learningRouter.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    const progressList = await db.lessonProgress.findMany({ where: { userId: req.user!.id } });
    const completedSet = new Set(progressList.filter((p: any) => p.completed).map((p: any) => p.lessonId));

    let defaultLevel: "Kids" | "Teens" | "Adults" = "Adults";
    if ((user?.age ?? 25) < 13) defaultLevel = "Kids";
    else if ((user?.age ?? 25) < 18) defaultLevel = "Teens";

    const modulesWithStatus = MODULES.map(m => ({
      ...m,
      completed: completedSet.has(m.id)
    }));

    return res.json({
      defaultLevel,
      modules: modulesWithStatus,
      streakDays: user?.streakDays || 1,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to load learning modules" });
  }
});

learningRouter.post("/complete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId, answerIndex } = req.body;
    const targetModule = MODULES.find(m => m.id === moduleId);

    if (!targetModule) {
      return res.status(404).json({ error: "Module not found" });
    }

    if (answerIndex !== targetModule.quiz.correctIndex) {
      return res.status(400).json({
        correct: false,
        message: "Incorrect answer. Review the hint and try again!",
        explanation: targetModule.quiz.explanation
      });
    }

    const newStreak = await db.$transaction(async (tx: any) => {
      await tx.lessonProgress.upsert({
        where: {
          userId_lessonId: {
            userId: req.user!.id,
            lessonId: moduleId
          }
        },
        update: { completed: true },
        create: {
          userId: req.user!.id,
          lessonId: moduleId,
          completed: true
        }
      });

      const user = await tx.user.findUnique({ where: { id: req.user!.id } });
      const streak = (user?.streakDays || 1) + 1;

      await tx.user.update({
        where: { id: req.user!.id },
        data: { streakDays: streak }
      });

      await tx.wallet.update({
        where: { userId: req.user!.id },
        data: { everydayCents: { increment: targetModule.rewardCents } }
      });

      await tx.transaction.create({
        data: {
          userId: req.user!.id,
          walletType: "everyday",
          type: "learning_reward",
          amountCents: targetModule.rewardCents,
          note: `Knowledge Reward: Completed "${targetModule.title}"`
        }
      });

      return streak;
    });

    return res.json({
      correct: true,
      rewardCents: targetModule.rewardCents,
      newStreak,
      explanation: targetModule.quiz.explanation,
      message: `🎉 Correct! You earned ${(targetModule.rewardCents / 100).toFixed(2)} and extended your streak to ${newStreak} days!`,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to submit quiz" });
  }
});
