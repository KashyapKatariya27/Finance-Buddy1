import { Router, Response } from "express";
import db from "../db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { GROQ_API_KEY, DISCLAIMER } from "../config";
import { calculateGoalPacing } from "../utils/calculator";

export const aiRouter = Router();

// Heuristic rule-based fallback and prompt generator
function generateRuleBasedAdvice(user: any, goals: any[], query?: string): string {
  const isKid = user.age < 13;
  const isTeen = user.age >= 13 && user.age < 18;
  const activeGoals = goals.filter((g: any) => g.status === "active");

  if (activeGoals.length === 0) {
    if (isKid) {
      return "Hi there, Champion! 🌟 You don't have any active goals yet. What toy, book, or adventure do you want to save for next?";
    }
    if (isTeen) {
      return "Hey! Ready to level up your pocket money? Set a goal for a tech gadget, course, or sneaker drop to get started!";
    }
    return "Welcome! Start by establishing a key milestone — whether an emergency fund runway, investment seed, or upcoming life event.";
  }

  // Find most pressing goal
  const primaryGoal = activeGoals[0];
  const pacing = calculateGoalPacing(primaryGoal);
  const currencySymbol = user.currency === "USD" ? "$" : "₹";
  const requiredAmount = (pacing.requiredPerWeekCents / 100).toFixed(0);

  if (isKid) {
    if (pacing.onTrack) {
      return `Super job on "${primaryGoal.name}"! 🚀 You are on track! Saving just ${currencySymbol}${requiredAmount} this week will keep you rocketing forward!`;
    }
    return `You're working hard on "${primaryGoal.name}"! 💡 If you stash away ${currencySymbol}${requiredAmount} more this week, you'll be right back on track!`;
  }

  if (isTeen) {
    if (pacing.onTrack) {
      return `Great momentum on "${primaryGoal.name}". Stashing ${currencySymbol}${requiredAmount}/week keeps you ahead of your ${primaryGoal.deadline} deadline. Consider enabling round-ups on snack runs!`;
    }
    return `Heads up: You're slightly behind schedule on "${primaryGoal.name}". Allocating an extra ${currencySymbol}${requiredAmount} per week will close the gap without stressing your budget.`;
  }

  // Adults
  if (pacing.onTrack) {
    return `Your pacing on "${primaryGoal.name}" is optimal. At your current savings velocity, you are projected to reach ${currencySymbol}${(primaryGoal.targetCents / 100).toLocaleString()} by ${pacing.projectedCompletionDate}. Keep your 50/20/30 split steady!`;
  }
  return `Strategic Insight: You are currently behind target on "${primaryGoal.name}". Increasing your weekly allocation by ${currencySymbol}${requiredAmount} or routing round-ups will ensure completion by ${primaryGoal.deadline}.`;
}

// GET proactive AI insights for dashboard
aiRouter.get("/insights", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const goals = await db.goal.findMany({ where: { userId: user.id, status: "active" } });
    const currencySym = user.currency === "USD" ? "$" : "₹";

    const insights: string[] = [];

    for (const goal of goals) {
      const pacing = calculateGoalPacing(goal);
      if (pacing.percent >= 100) {
        insights.push(`🎉 "${goal.name}" has reached 100%! Ready to withdraw or start a new milestone?`);
      } else if (!pacing.onTrack) {
        const behindWeekCents = pacing.requiredPerWeekCents;
        insights.push(`Save ${currencySym}${(behindWeekCents / 100).toFixed(0)} more per week to finish "${goal.name}" on time.`);
      } else {
        insights.push(`"${goal.name}" is on track! Projected completion: ${pacing.projectedCompletionDate}.`);
      }
    }

    if (insights.length === 0) {
      insights.push(`Tip: Allocate funds according to your ${user.splitEveryday}/${user.splitEmergency}/${user.splitSavings} plan to build strong financial habits.`);
    }

    return res.json({
      insights,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to generate insights" });
  }
});

// POST interactive AI chat / coach advice
aiRouter.post("/suggestion", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { query } = req.body;
    const goals = await db.goal.findMany({ where: { userId: user.id } });

    // Fallback response generator
    let advice = generateRuleBasedAdvice(user, goals, query);

    // If Groq API key is configured, query Groq LLM
    if (GROQ_API_KEY) {
      try {
        const systemPrompt = `You are FinanceBuddy AI, an empowering financial mentor.
Current User Context:
- Name: ${user.fullName}
- Age: ${user.age} (${user.age < 13 ? "Child" : user.age < 18 ? "Teenager" : "Adult"})
- Account Mode: ${user.accountMode}
- Currency: ${user.currency}
- Plan Split: ${user.splitEveryday}% Everyday, ${user.splitEmergency}% Emergency, ${user.splitSavings}% Savings.
- Active Goals: ${JSON.stringify(goals.map((g: any) => ({ name: g.name, target: g.targetCents / 100, current: g.currentCents / 100, deadline: g.deadline })))}

Guidelines:
- If Child (age < 13): Use a playful, cheerful, simple tone with emojis. Focus on piggy bank habits.
- If Teen (13-17): Be relatable, encouraging, practical, and tech-savvy.
- If Adult (18+): Be strategic, professional, motivational, and focused on emergency runway and disciplined milestone pacing.
- Mandatory Rule: Never give real investment guarantees or suggest debt. All balances in this application are simulated.`;

        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: query || "Give me advice on reaching my goals." }
            ],
            temperature: 0.6,
            max_tokens: 250
          })
        });

        if (resp.ok) {
          const data = (await resp.json()) as any;
          const llmText = data.choices?.[0]?.message?.content;
          if (llmText) {
            advice = llmText;
          }
        }
      } catch (e) {
        console.warn("Groq LLM call failed, using heuristic advice fallback");
      }
    }

    return res.json({
      advice,
      userRole: user.role,
      userAge: user.age,
      disclaimer: DISCLAIMER
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to get AI advice" });
  }
});
