"use strict";
// /api/ai-suggestion.js
// Goal-first AI Coach & Buddy: adapts tone by age and mode (playful for kids, motivating for adults).
// Uses Groq API (llama-3.1-8b-instant) if GROQ_API_KEY is configured,
// and falls back seamlessly to an intelligent local heuristic engine.

function formatCurrency(cents, currency = "INR") {
  const symbol = currency === "USD" ? "$" : "₹";
  const num = (Number(cents) || 0) / 100;
  return `${symbol}${num.toLocaleString(currency === "USD" ? "en-US" : "en-IN", {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function computeGoalInsights(goals = [], currency = "INR") {
  const insights = [];
  if (!Array.isArray(goals) || goals.length === 0) {
    insights.push("Set your first savings goal to unlock personalized AI milestones and tracking!");
    return insights;
  }

  for (const g of goals) {
    const target = Number(g.target_cents || g.target || 0);
    const current = Number(g.current_cents || g.current || 0);
    const requiredPerWeek = Number(g.required_per_week_cents || 0);
    const name = g.name || "your goal";
    const status = g.on_track_status || "on_track";
    const daysDiff = Number(g.days_ahead_or_behind || 0);

    if (current >= target && target > 0) {
      insights.push(`🎉 Congratulations! You achieved "${name}". You can now withdraw the funds or start a new goal!`);
    } else if (status === "behind") {
      const behindAmt = Math.max(100, Math.round(target * 0.1));
      insights.push(`You are ${formatCurrency(behindAmt, currency)} behind your target this month for "${name}". Save ${formatCurrency(requiredPerWeek, currency)} more per week to finish on time.`);
    } else if (status === "ahead" || daysDiff >= 14) {
      const weeks = Math.max(1, Math.round(daysDiff / 7));
      insights.push(`Great pace! Your goal "${name}" can finish ${weeks} ${weeks === 1 ? "week" : "weeks"} early at your current savings speed!`);
    } else {
      if (requiredPerWeek > 0) {
        insights.push(`Save ${formatCurrency(requiredPerWeek, currency)} per week to reach "${name}" by the deadline.`);
      }
    }
  }

  return insights;
}

function getToneForAge(age = 25, role = "individual", accountMode = "myself") {
  const numericAge = Number(age) || 25;
  if (role === "child" || numericAge <= 12) {
    return "playful";
  }
  if (accountMode === "teen" || (numericAge >= 13 && numericAge <= 17)) {
    return "empowering";
  }
  return "motivating";
}

async function getAiSuggestion({
  amount,
  splitPercentages,
  studentName,
  age = 25,
  role = "individual",
  accountMode = "myself",
  currency = "INR",
  goals = [],
  emergencyFundMonths = null
}) {
  const numericAmount = Number(amount);
  const everydayPct = Number(splitPercentages?.everydayPct ?? 50);
  const emergencyPct = Number(splitPercentages?.emergencyPct ?? 20);
  const savingPct = Number(splitPercentages?.savingPct ?? 30);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > 100000000 ||
    !Number.isFinite(everydayPct) ||
    !Number.isFinite(emergencyPct) ||
    !Number.isFinite(savingPct) ||
    everydayPct < 0 ||
    emergencyPct < 0 ||
    savingPct < 0 ||
    everydayPct + emergencyPct + savingPct !== 100
  ) {
    const error = new Error("Invalid amount or splitPercentages (must sum to 100%).");
    error.status = 400;
    throw error;
  }

  const safeName = String(studentName || "there").trim().replace(/[\r\n<>]/g, "").slice(0, 80) || "there";
  const everydayAmt = Math.round((numericAmount * everydayPct) / 100);
  const emergencyAmt = Math.round((numericAmount * emergencyPct) / 100);
  const savingAmt = numericAmount - everydayAmt - emergencyAmt;

  const tone = getToneForAge(age, role, accountMode);
  const goalInsights = computeGoalInsights(goals, currency);

  if (emergencyFundMonths !== null && emergencyFundMonths !== undefined) {
    if (emergencyFundMonths >= 3) {
      goalInsights.unshift(`🛡️ Emergency vault covers ${emergencyFundMonths} months of essential expenses — great financial cushion!`);
    } else {
      goalInsights.unshift(`💡 Aim for 3-6 months of emergency reserve (currently ${emergencyFundMonths} months covered).`);
    }
  }

  // Local rule-based explanation customized by tone
  let fallback = "";
  if (tone === "playful") {
    fallback = `Woohoo ${safeName}! 🌟 Your ${formatCurrency(numericAmount * 100, currency)} is all set! ` +
      `We tucked ${formatCurrency(savingAmt * 100, currency)} into your Savings Goal, ` +
      `${formatCurrency(emergencyAmt * 100, currency)} safely in the Emergency Chest, ` +
      `and you have ${formatCurrency(everydayAmt * 100, currency)} ready for everyday fun! Keep shining! 🚀`;
  } else if (tone === "empowering") {
    fallback = `Awesome progress ${safeName}! 💪 You allocated ${formatCurrency(numericAmount * 100, currency)}: ` +
      `${formatCurrency(savingAmt * 100, currency)} (${savingPct}%) toward your milestone goals, ` +
      `${formatCurrency(emergencyAmt * 100, currency)} (${emergencyPct}%) to build your safety net, ` +
      `and ${formatCurrency(everydayAmt * 100, currency)} (${everydayPct}%) for your spending. You are mastering your financial independence!`;
  } else {
    fallback = `Great execution ${safeName}! 📈 For your ${formatCurrency(numericAmount * 100, currency)} allocation: ` +
      `${formatCurrency(savingAmt * 100, currency)} (${savingPct}%) fuels your active wealth goals, ` +
      `${formatCurrency(emergencyAmt * 100, currency)} (${emergencyPct}%) reinforces your protected emergency reserve, ` +
      `and ${formatCurrency(everydayAmt * 100, currency)} (${everydayPct}%) is assigned for monthly essentials. Consistency leads to financial freedom.`;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      explanation: fallback,
      source: "heuristic",
      tone,
      insights: goalInsights,
      split: { everydayAmt, emergencyAmt, savingAmt }
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const systemPrompt = tone === "playful"
      ? "You are FinanceBuddy AI Coach, a cheerful, encouraging mentor for kids and early savers. Keep responses warm, playful, and 2-3 sentences. Mention the exact split amounts provided. Never suggest gambling, real bank transfers, or risky investments."
      : tone === "empowering"
      ? "You are FinanceBuddy AI Coach, an inspiring mentor for teens and college students. Keep responses motivating, clear, and 2-3 sentences. Highlight goal discipline and building financial independence with the exact amounts provided."
      : "You are FinanceBuddy AI Coach, a strategic, motivating financial advisor for adults. Write a concise 2-3 sentence overview emphasizing disciplined goal achievement, emergency fund security, and steady progress using the exact amounts provided.";

    const userPrompt = `User: ${safeName}, Age: ${age}, Mode: ${accountMode}. ` +
      `Amount: ${formatCurrency(numericAmount * 100, currency)}. ` +
      `Split: Everyday ${formatCurrency(everydayAmt * 100, currency)} (${everydayPct}%), ` +
      `Emergency ${formatCurrency(emergencyAmt * 100, currency)} (${emergencyPct}%), ` +
      `Savings Goals ${formatCurrency(savingAmt * 100, currency)} (${savingPct}%). ` +
      `Primary Goal status: ${goals[0]?.name || "None"}. Explain this allocation concisely.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 180,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
    const data = await response.json();
    const explanation = data?.choices?.[0]?.message?.content?.trim();
    if (!explanation) throw new Error("Empty response from Groq");

    return {
      explanation,
      source: "groq",
      tone,
      insights: goalInsights,
      split: { everydayAmt, emergencyAmt, savingAmt }
    };
  } catch (err) {
    return {
      explanation: fallback,
      source: "fallback",
      tone,
      insights: goalInsights,
      split: { everydayAmt, emergencyAmt, savingAmt }
    };
  }
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }
  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const result = await getAiSuggestion(parsed);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(err.status || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Internal server error" }));
    }
  });
}

module.exports = {
  getAiSuggestion,
  computeGoalInsights,
  getToneForAge,
  formatCurrency,
  default: handler
};
