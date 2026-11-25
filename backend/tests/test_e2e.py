import pytest
import os
from starlette.testclient import TestClient

# Ensure test database path
test_db_dir = os.path.join(os.path.dirname(__file__), "test_data")
os.makedirs(test_db_dir, exist_ok=True)
os.environ["DATABASE_PATH"] = os.path.join(test_db_dir, "test.sqlite")
os.environ["SESSION_SECRET"] = "test-session-secret-key-12345"

from backend.app.main import app
from backend.app.database import migrate_schema, seed_demo_accounts

client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    migrate_schema()
    seed_demo_accounts()
    yield
    try:
        if os.path.exists(os.environ["DATABASE_PATH"]):
            os.remove(os.environ["DATABASE_PATH"])
    except Exception:
        pass

def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}

# ==========================================
# TEST SUITE
# ==========================================

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["runtime"] == "python-fastapi"
    assert "simulated; no real money is held or moved" in data["disclaimer"]

def test_seed_demo_accounts():
    # 1. Sarah (Parent, Family)
    res_sarah = client.post("/api/auth/login", json={"email": "sarah@example.com", "password": "password123"})
    assert res_sarah.status_code == 200
    data_sarah = res_sarah.json()
    assert data_sarah["user"]["role"] == "parent"
    assert data_sarah["user"]["accountMode"] == "family"

    # 2. Leo (Child, Family)
    res_leo = client.post("/api/auth/login", json={"email": "leo@example.com", "password": "password123"})
    assert res_leo.status_code == 200
    data_leo = res_leo.json()
    assert data_leo["user"]["role"] == "child"
    assert data_leo["redirectTo"] == "/kids"

    # 3. Riya (Individual, Myself)
    res_riya = client.post("/api/auth/login", json={"email": "riya@example.com", "password": "password123"})
    assert res_riya.status_code == 200
    data_riya = res_riya.json()
    assert data_riya["user"]["role"] == "individual"
    assert data_riya["user"]["accountMode"] == "myself"

    # 4. Aman (Student, Teen)
    res_aman = client.post("/api/auth/login", json={"email": "aman@example.com", "password": "password123"})
    assert res_aman.status_code == 200
    data_aman = res_aman.json()
    assert data_aman["user"]["accountMode"] == "teen"
    assert data_aman["user"]["accountabilityPartnerEmail"] == "mentor@example.com"

def test_family_mode_flow():
    sarah_token = client.post("/api/auth/login", json={"email": "sarah@example.com", "password": "password123"}).json()["token"]
    leo_token = client.post("/api/auth/login", json={"email": "leo@example.com", "password": "password123"}).json()["token"]

    # Sarah views linked children
    res_children = client.get("/api/children", headers=auth_headers(sarah_token))
    assert res_children.status_code == 200
    assert len(res_children.json()["children"]) >= 1

    # Sarah funds wallet (50/30/20 auto-split)
    res_fund = client.post("/api/funds", json={"amount": "1000", "note": "Allowance funding"}, headers=auth_headers(sarah_token))
    assert res_fund.status_code == 201

    # Leo requests early withdrawal for goal
    leo_goals = client.get("/api/goals", headers=auth_headers(leo_token)).json()["goals"]
    active_goal = leo_goals[0]
    res_withdraw = client.post(f"/api/goals/{active_goal['id']}/withdraw", json={"amount": "50", "reason": "Laptop case and mouse"}, headers=auth_headers(leo_token))
    assert res_withdraw.status_code == 200
    assert res_withdraw.json().get("requiresParentApproval") is True

    # Sarah reviews and approves request
    sarah_dash = client.get("/api/dashboard", headers=auth_headers(sarah_token)).json()
    pending_id = sarah_dash["pendingApproval"]["id"]
    res_review = client.post(f"/api/approvals/{pending_id}/review", json={"decision": "approved"}, headers=auth_headers(sarah_token))
    assert res_review.status_code == 200
    assert "approved" in res_review.json()["message"]

def test_myself_individual_mode_flow():
    # Minor restriction: age < 18 rejected under myself mode
    res_minor = client.post("/api/auth/register", json={
        "fullName": "Teen Trying Alone",
        "email": "minor_test@example.com",
        "password": "password123",
        "accountMode": "myself",
        "age": 16
    })
    assert res_minor.status_code == 400
    assert "Children under 18 must always stay under a guardian" in res_minor.json()["detail"]

    riya_token = client.post("/api/auth/login", json={"email": "riya@example.com", "password": "password123"}).json()["token"]

    # Riya views active goals (Trip to Japan, 6-Month Emergency Safety Net)
    goals = client.get("/api/goals", headers=auth_headers(riya_token)).json()["goals"]
    assert len(goals) >= 2
    trip_goal = next(g for g in goals if g["name"] == "Trip to Japan")
    assert trip_goal["progressPercentage"] == 75
    assert trip_goal["milestones"]["m75"] is True

    # Create unlimited goal
    res_create = client.post("/api/goals", json={
        "name": "Masters Degree Fund",
        "category": "education",
        "targetAmount": "300000",
        "deadline": "2028-06-30",
        "priority": "high",
        "icon": "🎓",
        "roundUpEnabled": True
    }, headers=auth_headers(riya_token))
    assert res_create.status_code == 201
    new_goal = res_create.json()["goal"]
    assert new_goal["requiredPerWeekCents"] > 0

    # Manual deposit into goal
    res_dep = client.post(f"/api/goals/{new_goal['id']}/deposit", json={"amount": "1000"}, headers=auth_headers(riya_token))
    assert res_dep.status_code == 200
    assert res_dep.json()["goal"]["currentCents"] == 100000

    # Simulated card spend with round-up savings (₹82 -> rounds to ₹90, ₹8 saved to goal)
    res_spend = client.post(f"/api/goals/{new_goal['id']}/simulate-spend", json={"spendAmount": "82", "note": "Lunch spend"}, headers=auth_headers(riya_token))
    assert res_spend.status_code == 200
    assert res_spend.json()["roundUpSaved"] == 800  # ₹8 in cents

    # Self-discipline lock: Early withdrawal triggers 24h cooling-off
    res_early = client.post(f"/api/goals/{new_goal['id']}/withdraw", json={"amount": "500", "reason": "Urgent textbook purchase"}, headers=auth_headers(riya_token))
    assert res_early.status_code == 200
    early_data = res_early.json()
    assert early_data.get("coolingOff") is True
    assert early_data.get("delayDays") > 0
    approval_id = early_data["approvalId"]

    # Finalize cooling-off with simulate_bypass
    res_fin = client.post(f"/api/approvals/{approval_id}/finalize-cooling-off", json={"simulate_bypass": True}, headers=auth_headers(riya_token))
    assert res_fin.status_code == 200
    assert "Cooling-off complete" in res_fin.json()["message"]

    # Completed goal allows instant payout with no cooling-off lock
    safety_goal = next(g for g in goals if g["name"] == "6-Month Emergency Safety Net")
    assert safety_goal["isCompleted"] is True
    res_comp_with = client.post(f"/api/goals/{safety_goal['id']}/withdraw", json={"amount": "1000", "reason": "Goal achieved drawdown"}, headers=auth_headers(riya_token))
    assert res_comp_with.status_code == 200
    assert res_comp_with.json()["completed"] is True

    # Emergency guidance shows 3-6 months metrics
    dash = client.get("/api/dashboard", headers=auth_headers(riya_token)).json()
    assert dash["emergencyGuidance"]["monthsCovered"] >= 3

    # Custom plan split
    res_split = client.post("/api/plan-split", json={"everyday": 40, "emergency": 30, "savings": 30}, headers=auth_headers(riya_token))
    assert res_split.status_code == 200
    assert res_split.json()["split"]["everyday"] == 40

def test_teen_student_mode_flow():
    aman_token = client.post("/api/auth/login", json={"email": "aman@example.com", "password": "password123"}).json()["token"]
    me = client.get("/api/me", headers=auth_headers(aman_token)).json()["user"]
    assert me["accountMode"] == "teen"
    assert me["accountabilityPartnerEmail"] == "mentor@example.com"

    # Early withdrawal triggers accountability partner approval
    goals = client.get("/api/goals", headers=auth_headers(aman_token)).json()["goals"]
    laptop = goals[0]
    res_withdraw = client.post(f"/api/goals/{laptop['id']}/withdraw", json={"amount": "1000", "reason": "Campus subscription"}, headers=auth_headers(aman_token))
    assert res_withdraw.status_code == 200
    assert res_withdraw.json().get("requiresPartnerApproval") is True
    assert res_withdraw.json().get("partnerEmail") == "mentor@example.com"

def test_currency_selector_and_learning_hub():
    riya_token = client.post("/api/auth/login", json={"email": "riya@example.com", "password": "password123"}).json()["token"]

    # Currency toggle
    res_usd = client.post("/api/currency", json={"currency": "USD"}, headers=auth_headers(riya_token))
    assert res_usd.status_code == 200
    assert res_usd.json()["currency"] == "USD"
    res_inr = client.post("/api/currency", json={"currency": "INR"}, headers=auth_headers(riya_token))
    assert res_inr.status_code == 200
    assert res_inr.json()["currency"] == "INR"

    # Learning Hub
    res_learn = client.get("/api/learning", headers=auth_headers(riya_token))
    assert res_learn.status_code == 200
    mods = res_learn.json()["modules"]
    levels = {m["level"] for m in mods}
    assert "Kids" in levels and "Teens" in levels and "Adults" in levels

    # Complete a module and verify streak
    res_complete = client.post("/api/learning/complete", json={"moduleId": "adults-budgeting-503020"}, headers=auth_headers(riya_token))
    assert res_complete.status_code == 200
    assert res_complete.json()["streakDays"] >= 2

def test_ai_coach_and_disclaimer():
    # Playful tone for kid
    res_kid = client.post("/api/ai-suggestion", json={"amount": 100, "age": 10, "role": "child", "accountMode": "family", "studentName": "Leo"})
    assert res_kid.status_code == 200
    assert res_kid.json()["tone"] == "playful"
    assert "Woohoo" in res_kid.json()["explanation"]

    # Motivating tone for adult
    res_adult = client.post("/api/ai-suggestion", json={"amount": 5000, "age": 28, "role": "individual", "accountMode": "myself", "studentName": "Riya"})
    assert res_adult.status_code == 200
    assert res_adult.json()["tone"] == "motivating"

    # HTML page returns disclaimer in SSR markup
    res_page = client.get("/")
    assert res_page.status_code == 200
    assert "All balances are simulated; no real money is held or moved" in res_page.text
