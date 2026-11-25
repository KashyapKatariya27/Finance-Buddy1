import os
import math
import mimetypes
from pathlib import Path
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .auth import hash_password, verify_password, create_session_token, verify_session_token
from .database import get_db, migrate_schema, seed_demo_accounts
from .models import (
    RegisterRequest, LoginRequest, CurrencyUpdateRequest, PlanSplitUpdateRequest,
    GoalCreateRequest, GoalDepositRequest, SimulateSpendRequest, GoalWithdrawRequest,
    FinalizeCoolingOffRequest, FundWalletRequest, ChildApprovalRequest,
    ReviewApprovalRequest, LearningCompleteRequest, AppEventRequest, AiSuggestionRequest
)
from .ai_coach import get_ai_suggestion, compute_goal_insights, get_tone_for_age, format_currency

DISCLAIMER = "FinanceBuddy is a goal-planning and learning tool. All balances are simulated; no real money is held or moved."

@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_schema()
    seed_demo_accounts()
    yield

app = FastAPI(title="FinanceBuddy API", version="2.0-goal-first", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_PUBLIC = Path(__file__).resolve().parent.parent.parent / "frontend" / "public"
FRONTEND_SRC = Path(__file__).resolve().parent.parent.parent / "frontend" / "src"

def get_cents(val: Any) -> int:
    try:
        s = str(val).strip()
        num = float(s)
        if num < 0 or math.isnan(num):
            return 0
        return int(round(num * 100))
    except Exception:
        return 0

def get_current_user(request: Request) -> Optional[Dict[str, Any]]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    session = verify_session_token(token)
    if not session or "id" not in session:
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (session["id"],)).fetchone()
        if not row:
            return None
        return dict(row)

def require_user(request: Request) -> Dict[str, Any]:
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return user

def get_preset_for_age(age: int) -> Dict[str, Any]:
    a = int(age or 25)
    if a <= 12:
        return {"category": "child", "name": "Child (6-12)", "everyday": 50, "emergency": 20, "savings": 30}
    if a <= 17:
        return {"category": "teen", "name": "Teen (13-17)", "everyday": 50, "emergency": 30, "savings": 20}
    if a <= 25:
        return {"category": "young_adult", "name": "Young Adult (18-25)", "everyday": 50, "emergency": 20, "savings": 30}
    return {"category": "adult", "name": "Adult (26+)", "everyday": 50, "emergency": 30, "savings": 20}

def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "fullName": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "accountMode": user.get("account_mode", "family"),
        "age": user.get("age", 25),
        "currency": user.get("currency", "INR"),
        "parentLinked": bool(user.get("parent_id")),
        "accountabilityPartnerEmail": user.get("accountability_partner_email"),
        "splitEveryday": user.get("split_everyday", 50),
        "splitEmergency": user.get("split_emergency", 20),
        "splitSavings": user.get("split_savings", 30),
        "monthlyExpensesCents": user.get("monthly_expenses_cents", 2000000),
        "streakDays": user.get("streak_days", 1),
        "disclaimer": DISCLAIMER
    }

def enrich_goal(goal: Dict[str, Any]) -> Dict[str, Any]:
    target = goal["target_cents"]
    current = goal["current_cents"]
    remaining = max(0, target - current)
    percent = min(100, round((current / target) * 100)) if target > 0 else 0

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        deadline_dt = datetime.strptime(goal["deadline"], "%Y-%m-%d")
    except Exception:
        deadline_dt = now

    days_rem = max(1, math.ceil((deadline_dt - now).total_seconds() / 86400))
    weeks_rem = max(1, math.ceil(days_rem / 7.0))
    months_rem = max(0.5, days_rem / 30.4)

    req_per_week = round(remaining / weeks_rem)
    req_per_month = round(remaining / months_rem)

    milestones = {
        "m25": percent >= 25,
        "m50": percent >= 50,
        "m75": percent >= 75,
        "m100": percent >= 100
    }

    on_track_status = "on_track"
    days_ahead_or_behind = 0
    if percent >= 100:
        on_track_status = "completed"
    else:
        try:
            created_dt = datetime.strptime(goal["created_at"].split()[0], "%Y-%m-%d")
        except Exception:
            created_dt = now
        total_days = max(1, math.ceil((deadline_dt - created_dt).total_seconds() / 86400))
        elapsed_days = max(1, math.ceil((now - created_dt).total_seconds() / 86400))
        expected_pct = min(100, round((elapsed_days / total_days) * 100))

        if percent < expected_pct - 10:
            on_track_status = "behind"
            days_ahead_or_behind = -round(((expected_pct - percent) / 100.0) * total_days)
        elif percent > expected_pct + 15:
            on_track_status = "ahead"
            days_ahead_or_behind = round(((percent - expected_pct) / 100.0) * total_days)

    projected_date = goal["deadline"]
    if percent >= 100:
        projected_date = now.strftime("%Y-%m-%d")

    return {
        "id": goal["id"],
        "userId": goal["user_id"],
        "name": goal["name"],
        "category": goal["category"],
        "targetCents": goal["target_cents"],
        "currentCents": goal["current_cents"],
        "target": goal["target_cents"],
        "current": goal["current_cents"],
        "deadline": goal["deadline"],
        "priority": goal["priority"],
        "icon": goal["icon"] or "🎯",
        "status": "completed" if percent >= 100 else goal["status"],
        "autoSaveCents": goal.get("auto_save_cents", 0),
        "autoSaveFrequency": goal.get("auto_save_frequency", "none"),
        "roundUpEnabled": bool(goal.get("round_up_enabled")),
        "progressPercentage": percent,
        "remainingCents": remaining,
        "requiredPerWeekCents": req_per_week,
        "requiredPerMonthCents": req_per_month,
        "daysRemaining": days_rem,
        "onTrackStatus": on_track_status,
        "daysAheadOrBehind": days_ahead_or_behind,
        "projectedCompletionDate": projected_date,
        "milestones": milestones,
        "isCompleted": percent >= 100,
        "createdAt": goal["created_at"]
    }

# Learning modules catalog
LEARNING_MODULES = [
    {"id": "kids-needs-wants", "level": "Kids", "title": "Needs vs. Wants: The Gold Standard", "description": "Understanding core spend metrics before committing savings plans.", "tag": "Need Guard Expert", "points": 50, "icon": "✓"},
    {"id": "kids-piggy-wallet", "level": "Kids", "title": "From Piggy Bank to Digital Wallet", "description": "How digital money works and why it feels different than physical cash.", "tag": "Junior Saver", "points": 50, "icon": "🐷"},
    {"id": "teens-compound-magic", "level": "Teens", "title": "The Compound Growth Magic Engine", "description": "How visual goals grow exponentially through systematic micro-deposits.", "tag": "Savings Alchemist", "points": 75, "icon": "📈"},
    {"id": "teens-avoid-scams", "level": "Teens", "title": "Spotting the Trap: Internet Scams & Security", "description": "Protect cards, identify phishing links, and lock passwords safely away.", "tag": "Web Shield Apprentice", "points": 75, "icon": "🛡️"},
    {"id": "adults-budgeting-503020", "level": "Adults", "title": "Modern Budgeting & The 50/30/20 Rule", "description": "Structure everyday expenses, emergency reserves, and long-term goal funds.", "tag": "Budget Master", "points": 100, "icon": "📊"},
    {"id": "adults-emergency-fund", "level": "Adults", "title": "Emergency Funds: 3-6 Months Liquid Runway", "description": "Calculating your non-negotiable living expenses and placing funds safely.", "tag": "Resilience Guard", "points": 100, "icon": "🔒"},
    {"id": "adults-sip-basics", "level": "Adults", "title": "SIP Basics & Systematic Compounding", "description": "How small regular monthly investments smooth volatility and build wealth.", "tag": "Wealth Builder", "points": 100, "icon": "🌱"},
    {"id": "adults-debt-management", "level": "Adults", "title": "Debt Basics: Good vs. Bad Debt & Repayment", "description": "Mastering interest rates, snowball vs. avalanche strategies, and credit scores.", "tag": "Debt Free Hero", "points": 100, "icon": "💳"},
    {"id": "adults-scam-prevention", "level": "Adults", "title": "Financial Scams: Ponzi Schemes & QR Code Traps", "description": "Recognize high-yield fraud, unauthorized mandates, and social engineering.", "tag": "Security Specialist", "points": 100, "icon": "🚨"}
]

# ==========================================
# REST API ENDPOINTS
# ==========================================

@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": "FinanceBuddy",
        "runtime": "python-fastapi",
        "version": "2.0-goal-first",
        "disclaimer": DISCLAIMER,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.post("/api/auth/register", status_code=201)
def register(body: RegisterRequest):
    full_name = body.fullName.strip()
    address = body.email.strip().lower()
    pw = body.password
    mode = body.accountMode if body.accountMode in ["family", "myself", "teen"] else "family"
    age = body.age or (16 if mode == "teen" else 25)
    currency = body.currency if body.currency in ["INR", "USD"] else "INR"

    if len(full_name) < 2:
        raise HTTPException(status_code=400, detail="Enter a name with at least 2 characters.")
    if "@" not in address or "." not in address:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    role = "individual"
    parent_id = None
    partner_email = None

    with get_db() as conn:
        if mode == "family":
            role = "child" if body.role == "child" else "parent"
            if role == "child":
                parent_email = (body.parentEmail or "").strip().lower()
                if not parent_email:
                    raise HTTPException(status_code=400, detail="Enter the email address of your registered parent account.")
                parent_row = conn.execute("SELECT id, role FROM users WHERE email = ?", (parent_email,)).fetchone()
                if not parent_row or parent_row["role"] != "parent":
                    raise HTTPException(status_code=400, detail="No parent account was found for that email address.")
                parent_id = parent_row["id"]
        elif mode == "myself":
            role = "individual"
            if age < 18:
                raise HTTPException(status_code=400, detail="Children under 18 must always stay under a guardian. Please register under Family or Teen mode.")
        elif mode == "teen":
            role = "individual"
            if body.accountabilityPartnerEmail:
                partner_email = body.accountabilityPartnerEmail.strip().lower()

        preset = get_preset_for_age(age)
        pw_hash = hash_password(pw)

        try:
            cursor = conn.execute("""
                INSERT INTO users (full_name, email, password_hash, role, account_mode, age, parent_id, accountability_partner_email, split_everyday, split_emergency, split_savings, currency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (full_name, address, pw_hash, role, mode, age, parent_id, partner_email, preset["everyday"], preset["emergency"], preset["savings"], currency))
            user_id = cursor.lastrowid
            new_user = dict(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())
            token = create_session_token(user_id, role)
            redirect_to = "/kids" if role == "child" else "/dashboard"
            return {
                "token": token,
                "user": public_user(new_user),
                "redirectTo": redirect_to
            }
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="An account already exists for this email.")

@app.post("/api/auth/login")
def login(body: LoginRequest):
    address = body.email.strip().lower()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (address,)).fetchone()
        if not row or not verify_password(body.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Email or password is incorrect.")
        user = dict(row)
        token = create_session_token(user["id"], user["role"])
        redirect_to = "/kids" if user["role"] == "child" else "/dashboard"
        return {
            "token": token,
            "user": public_user(user),
            "redirectTo": redirect_to
        }

@app.get("/api/me")
def get_me(user: Dict[str, Any] = Depends(require_user)):
    return {"user": public_user(user), "disclaimer": DISCLAIMER}

@app.post("/api/currency")
def set_currency(body: CurrencyUpdateRequest, user: Dict[str, Any] = Depends(require_user)):
    cur = body.currency.upper()
    if cur not in ["INR", "USD"]:
        raise HTTPException(status_code=400, detail="Currency must be INR or USD.")
    with get_db() as conn:
        conn.execute("UPDATE users SET currency = ? WHERE id = ?", (cur, user["id"]))
    return {"message": f"Currency set to {cur}.", "currency": cur}

@app.get("/api/dashboard")
def dashboard(user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        pending = None
        if user["role"] == "parent":
            p_row = conn.execute("SELECT id, amount_cents, reason, child_id FROM approvals WHERE parent_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", (user["id"],)).fetchone()
            if p_row:
                pending = {"id": p_row["id"], "amount": p_row["amount_cents"], "reason": p_row["reason"]}
        else:
            p_row = conn.execute("SELECT id, amount_cents, reason, child_id FROM approvals WHERE partner_email = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", (user["email"],)).fetchone()
            if p_row:
                pending = {"id": p_row["id"], "amount": p_row["amount_cents"], "reason": p_row["reason"]}

        cooling_rows = conn.execute("SELECT id, amount_cents, reason, unlock_at, delay_days, goal_id FROM approvals WHERE child_id = ? AND status = 'cooling_off' ORDER BY id DESC", (user["id"],)).fetchall()
        cooling_off = [
            {
                "id": r["id"],
                "amount": r["amount_cents"],
                "reason": r["reason"],
                "unlockAt": r["unlock_at"],
                "delayDays": r["delay_days"],
                "goalId": r["goal_id"],
                "isUnlocked": datetime.fromisoformat(r["unlock_at"]) <= datetime.utcnow() if r["unlock_at"] else False
            }
            for r in cooling_rows
        ]

        goal_rows = conn.execute("SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
        goals = [enrich_goal(dict(g)) for g in goal_rows]

        total = user["everyday_cents"] + user["emergency_cents"] + user["savings_cents"]
        monthly_exp = user.get("monthly_expenses_cents", 2000000)
        months_covered = round(user["emergency_cents"] / max(1, monthly_exp), 1)

        status = "Fully Funded (6+ Mos)" if months_covered >= 6 else ("Healthy Buffer (3-6 Mos)" if months_covered >= 3 else "Building Reserve (< 3 Mos)")

        return {
            "user": public_user(user),
            "balances": {
                "everyday": user["everyday_cents"],
                "emergency": user["emergency_cents"],
                "savings": user["savings_cents"],
                "total": total
            },
            "emergencyGuidance": {
                "monthlyExpenses": monthly_exp,
                "monthsCovered": months_covered,
                "target3Months": monthly_exp * 3,
                "target6Months": monthly_exp * 6,
                "status": status
            },
            "planSplit": {
                "everyday": user.get("split_everyday", 50),
                "emergency": user.get("split_emergency", 20),
                "savings": user.get("split_savings", 30),
                "preset": get_preset_for_age(user.get("age", 25))
            },
            "goals": goals,
            "pendingApproval": pending,
            "coolingOffRequests": cooling_off,
            "disclaimer": DISCLAIMER
        }

@app.post("/api/plan-split")
def update_plan_split(body: PlanSplitUpdateRequest, user: Dict[str, Any] = Depends(require_user)):
    if body.everyday < 0 or body.emergency < 0 or body.savings < 0 or (body.everyday + body.emergency + body.savings) != 100:
        raise HTTPException(status_code=400, detail="Split percentages must be integers summing to 100%.")
    with get_db() as conn:
        conn.execute("UPDATE users SET split_everyday = ?, split_emergency = ?, split_savings = ? WHERE id = ?", (body.everyday, body.emergency, body.savings, user["id"]))
    return {
        "message": f"Plan split updated: {body.everyday}% Everyday, {body.emergency}% Emergency, {body.savings}% Savings.",
        "split": {"everyday": body.everyday, "emergency": body.emergency, "savings": body.savings}
    }

@app.get("/api/goals")
def list_goals(user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC", (user["id"],)).fetchall()
        return {"goals": [enrich_goal(dict(r)) for r in rows], "disclaimer": DISCLAIMER}

@app.post("/api/goals", status_code=201)
def create_goal(body: GoalCreateRequest, user: Dict[str, Any] = Depends(require_user)):
    name = body.name.strip()
    target = get_cents(body.targetAmount)
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Enter a goal name with at least 2 characters.")
    if target <= 0:
        raise HTTPException(status_code=400, detail="Target amount must be greater than 0.")

    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, auto_save_cents, auto_save_frequency, round_up_enabled)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        """, (
            user["id"], name, body.category or "other", target, body.deadline,
            body.priority or "medium", body.icon or "🎯", get_cents(body.autoSaveAmount),
            body.autoSaveFrequency or "none", 1 if body.roundUpEnabled else 0
        ))
        row = conn.execute("SELECT * FROM goals WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return {"message": f'Goal "{name}" created!', "goal": enrich_goal(dict(row))}

@app.post("/api/goals/{goal_id}/deposit")
def deposit_to_goal(goal_id: int, body: GoalDepositRequest, user: Dict[str, Any] = Depends(require_user)):
    amount = get_cents(body.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid positive deposit amount.")

    with get_db() as conn:
        goal_row = conn.execute("SELECT * FROM goals WHERE id = ? AND user_id = ?", (goal_id, user["id"])).fetchone()
        if not goal_row:
            raise HTTPException(status_code=404, detail="Goal not found.")

        if user["everyday_cents"] < amount:
            raise HTTPException(status_code=400, detail="Insufficient balance in Everyday wallet to deposit into this goal.")

        conn.execute("UPDATE users SET everyday_cents = everyday_cents - ?, savings_cents = savings_cents + ? WHERE id = ?", (amount, amount, user["id"]))
        conn.execute("UPDATE goals SET current_cents = current_cents + ? WHERE id = ?", (amount, goal_id))
        conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'goal_deposit', ?, ?)",
                     (user["id"], amount, f"Deposit to goal: {goal_row['name']}"))

        updated_row = conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
        goal = enrich_goal(dict(updated_row))
        if goal["currentCents"] >= goal["targetCents"] and goal_row["current_cents"] < goal_row["target_cents"]:
            conn.execute("UPDATE goals SET status = 'completed' WHERE id = ?", (goal_id,))
            goal["status"] = "completed"

        return {
            "message": f"Deposited {format_currency(amount, user.get('currency', 'INR'))} into \"{goal['name']}\".",
            "goal": goal,
            "milestones": goal["milestones"]
        }

@app.post("/api/goals/{goal_id}/simulate-spend")
def simulate_spend(goal_id: int, body: SimulateSpendRequest, user: Dict[str, Any] = Depends(require_user)):
    spend = get_cents(body.spendAmount)
    if spend <= 0:
        raise HTTPException(status_code=400, detail="Enter a valid spend amount.")

    remainder = spend % 1000
    round_up_amount = 0 if remainder == 0 else (1000 - remainder)
    total_deduction = spend + round_up_amount

    if user["everyday_cents"] < total_deduction:
        raise HTTPException(status_code=400, detail="Insufficient balance in Everyday wallet for this purchase and round-up.")

    with get_db() as conn:
        goal_row = conn.execute("SELECT * FROM goals WHERE id = ? AND user_id = ?", (goal_id, user["id"])).fetchone()
        if not goal_row:
            raise HTTPException(status_code=404, detail="Goal not found.")

        conn.execute("UPDATE users SET everyday_cents = everyday_cents - ? WHERE id = ?", (total_deduction, user["id"]))
        if round_up_amount > 0:
            conn.execute("UPDATE users SET savings_cents = savings_cents + ? WHERE id = ?", (round_up_amount, user["id"]))
            conn.execute("UPDATE goals SET current_cents = current_cents + ? WHERE id = ?", (round_up_amount, goal_id))

        conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'spend', ?, ?)", (user["id"], spend, body.note or "Simulated Card Purchase"))
        if round_up_amount > 0:
            conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'round_up', ?, ?)",
                         (user["id"], round_up_amount, f"Round-up saved to {goal_row['name']}"))

        updated = dict(conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone())
        return {
            "message": f"Spent {format_currency(spend, user.get('currency', 'INR'))}! Saved {format_currency(round_up_amount, user.get('currency', 'INR'))} round-up into \"{updated['name']}\".",
            "roundUpSaved": round_up_amount,
            "goal": enrich_goal(updated)
        }

@app.post("/api/goals/{goal_id}/withdraw")
def withdraw_goal(goal_id: int, body: GoalWithdrawRequest, user: Dict[str, Any] = Depends(require_user)):
    amount = get_cents(body.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Enter a positive withdrawal amount.")

    with get_db() as conn:
        goal_row = conn.execute("SELECT * FROM goals WHERE id = ? AND user_id = ?", (goal_id, user["id"])).fetchone()
        if not goal_row:
            raise HTTPException(status_code=404, detail="Goal not found.")
        if goal_row["current_cents"] < amount:
            raise HTTPException(status_code=400, detail="Requested amount exceeds currently saved balance in this goal.")

        is_completed = goal_row["current_cents"] >= goal_row["target_cents"]
        if is_completed:
            conn.execute("UPDATE goals SET current_cents = current_cents - ? WHERE id = ?", (amount, goal_id))
            conn.execute("UPDATE users SET savings_cents = MAX(0, savings_cents - ?), everyday_cents = everyday_cents + ? WHERE id = ?", (amount, amount, user["id"]))
            conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'goal_withdraw', ?, ?)",
                         (user["id"], amount, f"Goal Achieved Withdrawal: {goal_row['name']}"))
            updated = dict(conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone())
            return {
                "completed": True,
                "message": f"🎉 Goal achieved! {format_currency(amount, user.get('currency', 'INR'))} moved to everyday spending!",
                "goal": enrich_goal(updated)
            }

        # Early withdrawal before goal completion
        reason = (body.reason or "").strip()
        if len(reason) < 4:
            raise HTTPException(status_code=400, detail="Please provide a valid reason for early withdrawal (at least 4 characters).")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        try:
            deadline_dt = datetime.strptime(goal_row["deadline"], "%Y-%m-%d")
        except Exception:
            deadline_dt = now
        total_days = max(1, math.ceil((deadline_dt - now).total_seconds() / 86400))
        delay_days = max(1, round((amount / max(1, goal_row["target_cents"])) * total_days))

        # Family child mode -> parent review
        if user["role"] == "child" and user.get("parent_id"):
            conn.execute("""
                INSERT INTO approvals (child_id, parent_id, amount_cents, reason, status, goal_id, delay_days, type)
                VALUES (?, ?, ?, ?, 'pending', ?, ?, 'early_goal_withdrawal')
            """, (user["id"], user["parent_id"], amount, reason, goal_id, delay_days))
            return {
                "requiresParentApproval": True,
                "delayDays": delay_days,
                "message": f"Early withdrawal request submitted to your guardian. It will delay your goal by approx {delay_days} days."
            }

        # Accountability partner mode
        if user.get("accountability_partner_email"):
            partner = user["accountability_partner_email"].strip().lower()
            conn.execute("""
                INSERT INTO approvals (child_id, amount_cents, reason, status, goal_id, partner_email, delay_days, type)
                VALUES (?, ?, ?, 'pending', ?, ?, ?, 'early_goal_withdrawal')
            """, (user["id"], amount, reason, goal_id, partner, delay_days))
            return {
                "requiresPartnerApproval": True,
                "partnerEmail": partner,
                "delayDays": delay_days,
                "message": f"Early withdrawal request sent to accountability partner ({partner}). It will delay your goal by approx {delay_days} days."
            }

        # Pure individual -> 24h cooling-off lock
        unlock_time = datetime.fromtimestamp(now.timestamp() + 86400).isoformat()
        cursor = conn.execute("""
            INSERT INTO approvals (child_id, amount_cents, reason, status, goal_id, unlock_at, cooling_off, delay_days, type)
            VALUES (?, ?, ?, 'cooling_off', ?, ?, 1, ?, 'early_goal_withdrawal')
        """, (user["id"], amount, reason, goal_id, unlock_time, delay_days))
        return {
            "coolingOff": True,
            "approvalId": cursor.lastrowid,
            "unlockAt": unlock_time,
            "delayDays": delay_days,
            "message": f"Self-discipline lock active: 24-hour cooling-off period initiated. This withdrawal delays your goal by {delay_days} days."
        }

@app.post("/api/approvals/{approval_id}/finalize-cooling-off")
def finalize_cooling_off(approval_id: int, body: FinalizeCoolingOffRequest, user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        app_row = conn.execute("SELECT * FROM approvals WHERE id = ? AND child_id = ? AND status = 'cooling_off'", (approval_id, user["id"])).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="No active cooling-off request found.")

        now_time = datetime.now(timezone.utc).replace(tzinfo=None)
        unlock_dt = datetime.fromisoformat(app_row["unlock_at"]) if app_row["unlock_at"] else now_time
        is_unlocked = unlock_dt <= now_time or bool(body.simulate_bypass)
        if not is_unlocked:
            raise HTTPException(status_code=403, detail="Cooling-off period is still active. Please wait until unlock time.")

        amt = app_row["amount_cents"]
        if app_row["goal_id"]:
            conn.execute("UPDATE goals SET current_cents = MAX(0, current_cents - ?) WHERE id = ?", (amt, app_row["goal_id"]))
        conn.execute("UPDATE users SET savings_cents = MAX(0, savings_cents - ?), everyday_cents = everyday_cents + ? WHERE id = ?", (amt, amt, user["id"]))
        conn.execute("UPDATE approvals SET status = 'completed' WHERE id = ?", (approval_id,))
        conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'early_withdraw', ?, ?)",
                     (user["id"], amt, f"Cooling-off finalized: {app_row['reason']}"))

        return {"message": f"Cooling-off complete: {format_currency(amt, user.get('currency', 'INR'))} released to your Everyday wallet."}

@app.post("/api/approvals/{approval_id}/review")
def review_approval(approval_id: int, body: ReviewApprovalRequest, user: Dict[str, Any] = Depends(require_user)):
    decision = body.decision.lower()
    if decision not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Choose approved or rejected.")

    with get_db() as conn:
        approval = conn.execute("SELECT * FROM approvals WHERE id = ? AND (parent_id = ? OR partner_email = ?) AND status = 'pending'",
                                (approval_id, user["id"], user["email"])).fetchone()
        if not approval:
            raise HTTPException(status_code=404, detail="This request is no longer pending or you do not have permission to review it.")

        amt = approval["amount_cents"]
        if decision == "approved":
            if approval["goal_id"]:
                conn.execute("UPDATE goals SET current_cents = MAX(0, current_cents - ?) WHERE id = ?", (amt, approval["goal_id"]))
            conn.execute("UPDATE users SET savings_cents = MAX(0, savings_cents - ?), everyday_cents = everyday_cents + ? WHERE id = ?",
                         (amt, amt, approval["child_id"]))
            conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'release', ?, ?)",
                         (approval["child_id"], amt, f"Approved release: {approval['reason']}"))

        conn.execute("UPDATE approvals SET status = ?, reviewed_by = ? WHERE id = ?", (decision, user["id"], approval_id))
        return {"message": "Request approved and funds released." if decision == "approved" else "Request rejected."}

@app.get("/api/learning")
def learning_catalog(user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        rows = conn.execute("SELECT module_id, completed FROM learning_progress WHERE user_id = ?", (user["id"],)).fetchall()
        completed_set = {r["module_id"] for r in rows if r["completed"]}

        default_level = "Kids" if (user["role"] == "child" or user.get("age", 25) <= 12) else ("Teens" if (user.get("account_mode") == "teen" or user.get("age", 25) <= 17) else "Adults")

        mods = [{**m, "isCompleted": m["id"] in completed_set} for m in LEARNING_MODULES]
        return {
            "modules": mods,
            "defaultLevel": default_level,
            "streakDays": user.get("streak_days", 1),
            "disclaimer": DISCLAIMER
        }

@app.post("/api/learning/complete")
def complete_learning_module(body: LearningCompleteRequest, user: Dict[str, Any] = Depends(require_user)):
    mod_id = body.moduleId.strip()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO learning_progress (user_id, module_id, completed, updated_at)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, module_id) DO UPDATE SET completed = 1, updated_at = CURRENT_TIMESTAMP
        """, (user["id"], mod_id))
        conn.execute("UPDATE users SET streak_days = streak_days + 1 WHERE id = ?", (user["id"],))
        new_streak = (user.get("streak_days") or 1) + 1
        return {"message": "Challenge completed! Streak updated.", "streakDays": new_streak}

@app.get("/api/ai-insights")
def ai_insights(user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        goal_rows = conn.execute("SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC", (user["id"],)).fetchall()
        goals = [enrich_goal(dict(g)) for g in goal_rows]
        monthly_exp = user.get("monthly_expenses_cents", 2000000)
        months = round(user["emergency_cents"] / max(1, monthly_exp), 1)

        insights = compute_goal_insights(goals, user.get("currency", "INR"))
        tone = get_tone_for_age(user.get("age", 25), user["role"], user.get("account_mode", "myself"))

        if months >= 6:
            insights.insert(0, f"🛡️ Excellent! Your emergency vault covers {months} months of expenses. You have a rock-solid buffer.")
        elif months >= 3:
            insights.insert(0, f"🛡️ Good safety buffer ({months} months covered). Consider expanding toward 6 months for complete peace of mind.")
        else:
            insights.insert(0, f"💡 Emergency guidance: Target 3-6 months of living expenses (currently {months} months covered).")

        return {
            "insights": insights,
            "tone": tone,
            "currency": user.get("currency", "INR"),
            "disclaimer": DISCLAIMER
        }

@app.post("/api/ai-suggestion")
async def ai_suggestion(body: AiSuggestionRequest, request: Request):
    user = get_current_user(request)
    age = body.age or (user.get("age") if user else 25)
    role = body.role or (user.get("role") if user else "individual")
    mode = body.accountMode or (user.get("account_mode") if user else "myself")
    currency = body.currency or (user.get("currency") if user else "INR")

    goals = []
    if user:
        with get_db() as conn:
            g_rows = conn.execute("SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC", (user["id"],)).fetchall()
            goals = [enrich_goal(dict(g)) for g in g_rows]

    months = None
    if user and user.get("monthly_expenses_cents", 0) > 0:
        months = round(user["emergency_cents"] / user["monthly_expenses_cents"], 1)

    res = await get_ai_suggestion(
        amount=float(body.amount or 0),
        split_percentages=body.splitPercentages or {
            "everydayPct": user.get("split_everyday", 50) if user else 50,
            "emergencyPct": user.get("split_emergency", 20) if user else 20,
            "savingPct": user.get("split_savings", 30) if user else 30
        },
        student_name=body.studentName or (user.get("full_name") if user else "Saver"),
        age=age,
        role=role,
        account_mode=mode,
        currency=currency,
        goals=goals,
        emergency_fund_months=months
    )
    return res

@app.get("/api/children")
def list_children(user: Dict[str, Any] = Depends(require_user)):
    if user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only a parent can view linked child accounts.")
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM users WHERE parent_id = ? ORDER BY full_name", (user["id"],)).fetchall()
        children = [
            {
                "id": c["id"],
                "fullName": c["full_name"],
                "email": c["email"],
                "balances": {
                    "everyday": c["everyday_cents"],
                    "emergency": c["emergency_cents"],
                    "savings": c["savings_cents"],
                    "total": c["everyday_cents"] + c["emergency_cents"] + c["savings_cents"]
                },
                "createdAt": c["created_at"]
            }
            for c in rows
        ]
        return {"children": children}

@app.get("/api/transactions")
def list_transactions(user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        if user["role"] == "parent":
            rows = conn.execute("""
                SELECT t.id, t.type, t.amount_cents, t.note, t.created_at, u.full_name
                FROM transactions t JOIN users u ON u.id = t.user_id
                WHERE t.user_id = ? OR u.parent_id = ?
                ORDER BY t.id DESC LIMIT 100
            """, (user["id"], user["id"])).fetchall()
        else:
            rows = conn.execute("""
                SELECT t.id, t.type, t.amount_cents, t.note, t.created_at, u.full_name
                FROM transactions t JOIN users u ON u.id = t.user_id
                WHERE t.user_id = ?
                ORDER BY t.id DESC LIMIT 100
            """, (user["id"],)).fetchall()

        txs = [
            {"id": r["id"], "type": r["type"], "amount": r["amount_cents"], "note": r["note"], "createdAt": r["created_at"], "accountName": r["full_name"]}
            for r in rows
        ]
        return {"transactions": txs, "currency": user.get("currency", "INR"), "disclaimer": DISCLAIMER}

@app.post("/api/funds", status_code=201)
def fund_wallet(body: FundWalletRequest, user: Dict[str, Any] = Depends(require_user)):
    amt = get_cents(body.amount)
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Enter a positive amount with no more than two decimal places.")

    ev_pct = user.get("split_everyday", 50)
    em_pct = user.get("split_emergency", 20)
    everyday = round((amt * ev_pct) / 100.0)
    emergency = round((amt * em_pct) / 100.0)
    savings = amt - everyday - emergency

    with get_db() as conn:
        conn.execute("UPDATE users SET everyday_cents = everyday_cents + ?, emergency_cents = emergency_cents + ?, savings_cents = savings_cents + ? WHERE id = ?",
                     (everyday, emergency, savings, user["id"]))
        conn.execute("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'fund', ?, ?)",
                     (user["id"], amt, body.note or "Wallet funded"))

    return {"message": f"Wallet funded and allocated ({ev_pct}% Everyday / {em_pct}% Emergency / {100 - ev_pct - em_pct}% Savings)."}

@app.post("/api/events", status_code=201)
def record_event(body: AppEventRequest, user: Dict[str, Any] = Depends(require_user)):
    with get_db() as conn:
        conn.execute("INSERT INTO app_events (user_id, action, details) VALUES (?, ?, ?)",
                     (user["id"], body.action, body.details or ""))
    return {"message": "Action saved."}

# ==========================================
# STATIC PAGES & FRONTEND SSR ROUTES
# ==========================================

PAGES = {
    "/": "lending.html",
    "/index": "lending.html",
    "/index.html": "lending.html",
    "/lending": "lending.html",
    "/lending.html": "lending.html",
    "/landing": "lending.html",
    "/landing.html": "lending.html",
    "/login": "login.html",
    "/login.html": "login.html",
    "/register": "register.html",
    "/register.html": "register.html",
    "/dashboard": "dashboard.html",
    "/dashboard.html": "dashboard.html",
    "/kids": "Wallet.html",
    "/kids.html": "Wallet.html",
    "/wallet": "Wallet.html",
    "/wallet.html": "Wallet.html",
    "/child": "child.html",
    "/child.html": "child.html",
    "/my-child": "my-child.html",
    "/my-child.html": "my-child.html",
    "/allowance": "allownance.html",
    "/allowance.html": "allownance.html",
    "/goals": "savinggoals1.html",
    "/goals.html": "savinggoals1.html",
    "/savinggoals.html": "savinggoals1.html",
    "/savinggoals1.html": "savinggoals1.html",
    "/activity": "Transaction.html",
    "/activity.html": "Transaction.html",
    "/transactions": "Transaction.html",
    "/transactions.html": "Transaction.html",
    "/learning": "learning.html",
    "/learning.html": "learning.html",
    "/withdrawal": "withdrawal.html",
    "/withdrawal.html": "withdrawal.html"
}

def render_html_page(filename: str) -> HTMLResponse:
    file_path = FRONTEND_PUBLIC / filename
    if not file_path.exists():
        # Fallback to root public if needed
        root_public = Path(__file__).resolve().parent.parent.parent / "public" / filename
        if root_public.exists():
            file_path = root_public
        else:
            return HTMLResponse("<!DOCTYPE html><html><body>Page not found</body></html>", status_code=404)

    content = file_path.read_text(encoding="utf-8")
    if "</body>" in content and '<script src="/client.js"' not in content:
        content = content.replace("</body>", '<script src="/client.js" defer></script></body>')
    return HTMLResponse(content)

@app.get("/client.js")
def serve_client_js():
    # Priority: frontend/dist/client.js, then frontend/public/client.js, then root client.js
    dist_js = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist" / "client.js"
    if dist_js.exists():
        return Response(content=dist_js.read_text(encoding="utf-8"), media_type="application/javascript")
    pub_js = FRONTEND_PUBLIC / "client.js"
    if pub_js.exists():
        return Response(content=pub_js.read_text(encoding="utf-8"), media_type="application/javascript")
    root_js = Path(__file__).resolve().parent.parent.parent / "client.js"
    if root_js.exists():
        return Response(content=root_js.read_text(encoding="utf-8"), media_type="application/javascript")
    return Response(content="// client.js not found", media_type="application/javascript", status_code=404)

@app.get("/emergency")
@app.get("/emergency.html")
def serve_emergency(request: Request):
    user = get_current_user(request)
    target = "emergencyC.html" if (user and user.get("role") == "child") else "emergencyP.html"
    return render_html_page(target)

@app.get("/{page_path:path}")
def serve_static_or_page(page_path: str):
    normalized = f"/{page_path}"
    if normalized in PAGES:
        return render_html_page(PAGES[normalized])

    # Check static asset in frontend/public
    candidate = FRONTEND_PUBLIC / page_path
    if candidate.exists() and candidate.is_file():
        mime, _ = mimetypes.guess_type(str(candidate))
        return FileResponse(str(candidate), media_type=mime or "application/octet-stream")

    # Case-insensitive Linux/Render fallback
    try:
        target_name = candidate.name.lower()
        for f in FRONTEND_PUBLIC.iterdir():
            if f.is_file() and f.name.lower() == target_name:
                mime, _ = mimetypes.guess_type(str(f))
                return FileResponse(str(f), media_type=mime or "application/octet-stream")
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="File or page not found.")
