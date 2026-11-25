import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

def format_currency(cents: int, currency: str = "INR") -> str:
    symbol = "$" if currency == "USD" else "₹"
    num = (cents or 0) / 100.0
    if num % 1 == 0:
        formatted = f"{int(num):,}"
    else:
        formatted = f"{num:,.2f}"
    return f"{symbol}{formatted}"

def get_tone_for_age(age: int = 25, role: str = "individual", account_mode: str = "myself") -> str:
    numeric_age = int(age or 25)
    if role == "child" or numeric_age <= 12:
        return "playful"
    if account_mode == "teen" or (13 <= numeric_age <= 17):
        return "empowering"
    return "motivating"

def compute_goal_insights(goals: List[Dict[str, Any]] = None, currency: str = "INR") -> List[str]:
    insights = []
    if not goals:
        insights.append("Set your first savings goal to unlock personalized AI milestones and tracking!")
        return insights

    for g in goals:
        target = int(g.get("target_cents") or g.get("target") or 0)
        current = int(g.get("current_cents") or g.get("current") or 0)
        req_per_week = int(g.get("required_per_week_cents") or 0)
        name = g.get("name") or "your goal"
        status = g.get("on_track_status") or "on_track"
        days_diff = int(g.get("days_ahead_or_behind") or 0)

        if current >= target and target > 0:
            insights.append(f"🎉 Congratulations! You achieved \"{name}\". You can now withdraw the funds or start a new goal!")
        elif status == "behind":
            behind_amt = max(100, int(target * 0.1))
            insights.append(
                f"You are {format_currency(behind_amt, currency)} behind your target this month for \"{name}\". "
                f"Save {format_currency(req_per_week, currency)} more per week to finish on time."
            )
        elif status == "ahead" or days_diff >= 14:
            weeks = max(1, round(days_diff / 7))
            w_str = "week" if weeks == 1 else "weeks"
            insights.append(f"Great pace! Your goal \"{name}\" can finish {weeks} {w_str} early at your current savings speed!")
        else:
            if req_per_week > 0:
                insights.append(f"Save {format_currency(req_per_week, currency)} per week to reach \"{name}\" by the deadline.")

    return insights

async def get_ai_suggestion(
    amount: float,
    split_percentages: Optional[Dict[str, Any]] = None,
    student_name: str = "Saver",
    age: int = 25,
    role: str = "individual",
    account_mode: str = "myself",
    currency: str = "INR",
    goals: List[Dict[str, Any]] = None,
    emergency_fund_months: Optional[float] = None
) -> Dict[str, Any]:
    numeric_amount = float(amount or 0)
    splits = split_percentages or {}
    everyday_pct = int(splits.get("everydayPct", 50))
    emergency_pct = int(splits.get("emergencyPct", 20))
    saving_pct = int(splits.get("savingPct", 30))

    everyday_amt = round((numeric_amount * everyday_pct) / 100.0)
    emergency_amt = round((numeric_amount * emergency_pct) / 100.0)
    saving_amt = round(numeric_amount - everyday_amt - emergency_amt)

    tone = get_tone_for_age(age, role, account_mode)
    goal_insights = compute_goal_insights(goals or [], currency)

    if emergency_fund_months is not None:
        if emergency_fund_months >= 3:
            goal_insights.insert(0, f"🛡️ Emergency vault covers {emergency_fund_months} months of essential expenses — great financial cushion!")
        else:
            goal_insights.insert(0, f"💡 Aim for 3-6 months of emergency reserve (currently {emergency_fund_months} months covered).")

    amt_cents = int(numeric_amount * 100)
    ev_cents = int(everyday_amt * 100)
    em_cents = int(emergency_amt * 100)
    sv_cents = int(saving_amt * 100)

    if tone == "playful":
        explanation = (
            f"Woohoo {student_name}! 🌟 Your {format_currency(amt_cents, currency)} is all set! "
            f"We tucked {format_currency(sv_cents, currency)} into your Savings Goal, "
            f"{format_currency(em_cents, currency)} safely in the Emergency Chest, "
            f"and you have {format_currency(ev_cents, currency)} ready for everyday fun! Keep shining! 🚀"
        )
    elif tone == "empowering":
        explanation = (
            f"Awesome progress {student_name}! 💪 You allocated {format_currency(amt_cents, currency)}: "
            f"{format_currency(sv_cents, currency)} ({saving_pct}%) toward your milestone goals, "
            f"{format_currency(em_cents, currency)} ({emergency_pct}%) to build your safety net, "
            f"and {format_currency(ev_cents, currency)} ({everyday_pct}%) for your spending. You are mastering your financial independence!"
        )
    else:
        explanation = (
            f"Great execution {student_name}! 📈 For your {format_currency(amt_cents, currency)} allocation: "
            f"{format_currency(sv_cents, currency)} ({saving_pct}%) fuels your active wealth goals, "
            f"{format_currency(em_cents, currency)} ({emergency_pct}%) reinforces your protected emergency reserve, "
            f"and {format_currency(ev_cents, currency)} ({everyday_pct}%) is assigned for monthly essentials. Consistency leads to financial freedom."
        )

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {
            "explanation": explanation,
            "source": "heuristic",
            "tone": tone,
            "insights": goal_insights,
            "split": {"everydayAmt": everyday_amt, "emergencyAmt": emergency_amt, "savingAmt": saving_amt}
        }

    try:
        req_body = json.dumps({
            "model": "llama-3.1-8b-instant",
            "max_tokens": 160,
            "messages": [
                {
                    "role": "system",
                    "content": f"You are FinanceBuddy AI Coach for {tone} tone. Keep responses warm, 2-3 sentences, using the exact amounts given."
                },
                {
                    "role": "user",
                    "content": f"Amount: {format_currency(amt_cents, currency)}. Everyday: {format_currency(ev_cents, currency)}. Emergency: {format_currency(em_cents, currency)}. Savings: {format_currency(sv_cents, currency)}."
                }
            ]
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=req_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            ai_text = res_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            if ai_text:
                return {
                    "explanation": ai_text,
                    "source": "groq",
                    "tone": tone,
                    "insights": goal_insights,
                    "split": {"everydayAmt": everyday_amt, "emergencyAmt": emergency_amt, "savingAmt": saving_amt}
                }
    except Exception:
        pass

    return {
        "explanation": explanation,
        "source": "fallback",
        "tone": tone,
        "insights": goal_insights,
        "split": {"everydayAmt": everyday_amt, "emergencyAmt": emergency_amt, "savingAmt": saving_amt}
    }
