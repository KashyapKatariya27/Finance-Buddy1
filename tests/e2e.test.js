"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Use an isolated temporary database for test runs
const testDbDir = path.join(__dirname, "../data-test");
fs.mkdirSync(testDbDir, { recursive: true });
const testDbPath = path.join(testDbDir, `test-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = testDbPath;
process.env.PORT = "0"; // random available port
process.env.NODE_ENV = "test";

const { server, db, migrateSchema, seedDemoAccounts } = require("../server.js");

let baseUrl = "";
let serverInstance;

test.before(async () => {
  migrateSchema();
  await seedDemoAccounts();
  await new Promise((resolve) => {
    serverInstance = server.listen(0, "127.0.0.1", () => {
      const port = serverInstance.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (serverInstance && serverInstance.close) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  try {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch {}
});

async function api(endpoint, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

test("1. Seed Demo Accounts & Authentication", async (t) => {
  await t.test("Seed accounts exist (Sarah, Leo, Riya, Aman)", async () => {
    const users = db.prepare("SELECT full_name, email, role, account_mode, age FROM users ORDER BY id").all();
    assert.equal(users.length >= 4, true);

    const emails = users.map(u => u.email);
    assert.equal(emails.includes("sarah@example.com"), true);
    assert.equal(emails.includes("leo@example.com"), true);
    assert.equal(emails.includes("riya@example.com"), true);
    assert.equal(emails.includes("aman@example.com"), true);
  });

  await t.test("Can login as Sarah (Parent, Family mode)", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "sarah@example.com", password: "password123" })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, "parent");
    assert.equal(res.data.user.accountMode, "family");
    assert.ok(res.data.token);
  });

  await t.test("Can login as Riya (Individual adult, Myself mode)", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "riya@example.com", password: "password123" })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, "individual");
    assert.equal(res.data.user.accountMode, "myself");
  });

  await t.test("Can login as Aman (Student, Teen mode)", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "aman@example.com", password: "password123" })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, "individual");
    assert.equal(res.data.user.accountMode, "teen");
    assert.equal(res.data.user.accountabilityPartnerEmail, "mentor@example.com");
  });
});

test("2. Mode 1: Family Mode (Parent Sarah & Child Leo)", async (t) => {
  let sarahToken = "";
  let leoToken = "";

  const sarahLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "sarah@example.com", password: "password123" })
  });
  sarahToken = sarahLogin.data.token;

  const leoLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "leo@example.com", password: "password123" })
  });
  leoToken = leoLogin.data.token;

  await t.test("Sarah can view linked children", async () => {
    const res = await api("/api/children", { method: "GET" }, sarahToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.children.length >= 1, true);
    assert.equal(res.data.children[0].email, "leo@example.com");
  });

  await t.test("Sarah funds wallet and 50/30/20 split is applied", async () => {
    const beforeDash = await api("/api/dashboard", { method: "GET" }, sarahToken);
    const beforeTotal = beforeDash.data.balances.total;

    const fundRes = await api("/api/funds", {
      method: "POST",
      body: JSON.stringify({ amount: "1000", note: "Family allowance deposit" })
    }, sarahToken);
    assert.equal(fundRes.status, 201);

    const afterDash = await api("/api/dashboard", { method: "GET" }, sarahToken);
    assert.equal(afterDash.data.balances.total, beforeTotal + 100000);
  });

  await t.test("Leo creates early withdrawal request which requires parent approval", async () => {
    const goalsRes = await api("/api/goals", { method: "GET" }, leoToken);
    const activeGoal = goalsRes.data.goals[0];
    assert.ok(activeGoal);

    // Request early withdrawal
    const reqRes = await api(`/api/goals/${activeGoal.id}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount: "50", reason: "Need accessories for laptop" })
    }, leoToken);

    assert.equal(reqRes.status, 201);
    assert.equal(reqRes.data.requiresParentApproval, true);
    assert.ok(reqRes.data.delayDays >= 1);
  });

  await t.test("Sarah reviews and approves Leo's request", async () => {
    const sarahDash = await api("/api/dashboard", { method: "GET" }, sarahToken);
    assert.ok(sarahDash.data.pendingApproval);
    const approvalId = sarahDash.data.pendingApproval.id;

    const reviewRes = await api(`/api/approvals/${approvalId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision: "approved" })
    }, sarahToken);

    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.data.message.includes("approved"), true);
  });
});

test("3. Mode 2: Myself Mode (Individual Adult Riya)", async (t) => {
  let riyaToken = "";
  const riyaLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "riya@example.com", password: "password123" })
  });
  riyaToken = riyaLogin.data.token;

  await t.test("Minor cannot register under Myself mode (< 18 restriction)", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Young Minor",
        email: "minor@example.com",
        password: "password123",
        accountMode: "myself",
        age: 15
      })
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.error.includes("Children under 18 must always stay under a guardian"), true);
  });

  await t.test("Riya can view active goals (Trip to Japan, 6-Month Emergency Safety Net)", async () => {
    const res = await api("/api/goals", { method: "GET" }, riyaToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.goals.length >= 2, true);

    const tripGoal = res.data.goals.find(g => g.name === "Trip to Japan");
    assert.ok(tripGoal);
    assert.equal(tripGoal.category, "travel");
    assert.equal(tripGoal.progressPercentage, 75);
    assert.equal(tripGoal.milestones.m25, true);
    assert.equal(tripGoal.milestones.m50, true);
    assert.equal(tripGoal.milestones.m75, true);
    assert.equal(tripGoal.milestones.m100, false);
  });

  await t.test("Riya can create unlimited goals with category and deadline", async () => {
    const res = await api("/api/goals", {
      method: "POST",
      body: JSON.stringify({
        name: "Home Renovation",
        category: "home",
        targetAmount: "250000",
        deadline: "2027-12-31",
        priority: "medium",
        icon: "🏡",
        roundUpEnabled: true
      })
    }, riyaToken);

    assert.equal(res.status, 201);
    assert.equal(res.data.goal.name, "Home Renovation");
    assert.ok(res.data.goal.requiredPerWeekCents > 0);
  });

  await t.test("Riya can make a manual deposit into a goal", async () => {
    const goalsRes = await api("/api/goals", { method: "GET" }, riyaToken);
    const tripGoal = goalsRes.data.goals.find(g => g.name === "Trip to Japan");

    const depRes = await api(`/api/goals/${tripGoal.id}/deposit`, {
      method: "POST",
      body: JSON.stringify({ amount: "5000" })
    }, riyaToken);

    assert.equal(depRes.status, 200);
    assert.equal(depRes.data.goal.currentCents, tripGoal.currentCents + 500000);
  });

  await t.test("Simulated card spend triggers round-up micro savings into goal", async () => {
    const goalsRes = await api("/api/goals", { method: "GET" }, riyaToken);
    const tripGoal = goalsRes.data.goals.find(g => g.name === "Trip to Japan");
    const beforeCurrent = tripGoal.currentCents;

    // Spend ₹82 -> rounds to ₹90, difference ₹8 (800 cents) saved to goal
    const spendRes = await api(`/api/goals/${tripGoal.id}/simulate-spend`, {
      method: "POST",
      body: JSON.stringify({ spendAmount: "82", note: "Coffee purchase" })
    }, riyaToken);

    assert.equal(spendRes.status, 200);
    assert.equal(spendRes.data.roundUpSaved, 800); // ₹8 round up
    assert.equal(spendRes.data.goal.currentCents, beforeCurrent + 800);
  });

  await t.test("Early withdrawal in Myself mode triggers 24-hour cooling-off lock", async () => {
    const goalsRes = await api("/api/goals", { method: "GET" }, riyaToken);
    const tripGoal = goalsRes.data.goals.find(g => g.name === "Trip to Japan");

    const withdrawRes = await api(`/api/goals/${tripGoal.id}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount: "1000", reason: "Emergency travel booking" })
    }, riyaToken);

    assert.equal(withdrawRes.status, 201);
    assert.equal(withdrawRes.data.coolingOff, true);
    assert.ok(withdrawRes.data.unlockAt);
    assert.ok(withdrawRes.data.delayDays > 0);

    // Finalize with simulate_bypass
    const finalizeRes = await api(`/api/approvals/${withdrawRes.data.approvalId}/finalize-cooling-off`, {
      method: "POST",
      body: JSON.stringify({ simulate_bypass: true })
    }, riyaToken);

    assert.equal(finalizeRes.status, 200);
    assert.equal(finalizeRes.data.message.includes("Cooling-off complete"), true);
  });

  await t.test("Completed goal allows immediate withdrawal without cooling-off lock", async () => {
    const goalsRes = await api("/api/goals", { method: "GET" }, riyaToken);
    const emergencyGoal = goalsRes.data.goals.find(g => g.name === "6-Month Emergency Safety Net");
    assert.ok(emergencyGoal.isCompleted);

    const withdrawRes = await api(`/api/goals/${emergencyGoal.id}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount: "5000", reason: "Goal achieved payout" })
    }, riyaToken);

    assert.equal(withdrawRes.status, 200);
    assert.equal(withdrawRes.data.completed, true);
    assert.equal(withdrawRes.data.message.includes("Goal achieved"), true);
  });

  await t.test("Emergency guidance shows 3-6 months coverage", async () => {
    const dashRes = await api("/api/dashboard", { method: "GET" }, riyaToken);
    assert.equal(dashRes.status, 200);
    const guidance = dashRes.data.emergencyGuidance;
    assert.ok(guidance.monthsCovered >= 3);
    assert.equal(guidance.target3Months, guidance.monthlyExpenses * 3);
    assert.equal(guidance.target6Months, guidance.monthlyExpenses * 6);
  });

  await t.test("Individual can customize plan split percentages", async () => {
    const splitRes = await api("/api/plan-split", {
      method: "POST",
      body: JSON.stringify({ everyday: 40, emergency: 30, savings: 30 })
    }, riyaToken);

    assert.equal(splitRes.status, 200);
    assert.equal(splitRes.data.split.everyday, 40);
  });
});

test("4. Mode 3: Teen / Student Mode (Aman Verma)", async (t) => {
  let amanToken = "";
  const amanLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "aman@example.com", password: "password123" })
  });
  amanToken = amanLogin.data.token;

  await t.test("Aman is in Teen mode with Accountability Partner", async () => {
    const me = await api("/api/me", { method: "GET" }, amanToken);
    assert.equal(me.data.user.accountMode, "teen");
    assert.equal(me.data.user.accountabilityPartnerEmail, "mentor@example.com");
  });

  await t.test("Early withdrawal routes to accountability partner approval", async () => {
    const goalsRes = await api("/api/goals", { method: "GET" }, amanToken);
    const laptopGoal = goalsRes.data.goals.find(g => g.name === "Study Laptop");
    assert.ok(laptopGoal);

    const reqRes = await api(`/api/goals/${laptopGoal.id}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount: "500", reason: "Semester fee deposit" })
    }, amanToken);

    assert.equal(reqRes.status, 201);
    assert.equal(reqRes.data.requiresPartnerApproval, true);
    assert.equal(reqRes.data.partnerEmail, "mentor@example.com");
  });
});

test("5. Currency Selector & Intl.NumberFormat Formatting", async (t) => {
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "riya@example.com", password: "password123" })
  });
  const token = login.data.token;

  await t.test("Can toggle currency to USD", async () => {
    const curRes = await api("/api/currency", {
      method: "POST",
      body: JSON.stringify({ currency: "USD" })
    }, token);
    assert.equal(curRes.status, 200);
    assert.equal(curRes.data.currency, "USD");

    const meRes = await api("/api/me", { method: "GET" }, token);
    assert.equal(meRes.data.user.currency, "USD");
  });

  await t.test("Can toggle currency back to INR", async () => {
    const curRes = await api("/api/currency", {
      method: "POST",
      body: JSON.stringify({ currency: "INR" })
    }, token);
    assert.equal(curRes.status, 200);
    assert.equal(curRes.data.currency, "INR");
  });
});

test("6. Learning Hub Levels & Streak", async (t) => {
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "riya@example.com", password: "password123" })
  });
  const token = login.data.token;

  await t.test("Learning Hub returns Kids, Teens, and Adults modules", async () => {
    const res = await api("/api/learning", { method: "GET" }, token);
    assert.equal(res.status, 200);
    const levels = res.data.modules.map(m => m.level);
    assert.equal(levels.includes("Kids"), true);
    assert.equal(levels.includes("Teens"), true);
    assert.equal(levels.includes("Adults"), true);

    // Verify adult topics are present
    const titles = res.data.modules.map(m => m.title);
    assert.equal(titles.some(t => t.includes("50/30/20")), true);
    assert.equal(titles.some(t => t.includes("Emergency Funds")), true);
    assert.equal(titles.some(t => t.includes("SIP Basics")), true);
    assert.equal(titles.some(t => t.includes("Debt Basics")), true);
    assert.equal(titles.some(t => t.includes("Financial Scams")), true);
  });

  await t.test("Completing a challenge updates streak and marks completed", async () => {
    const res = await api("/api/learning/complete", {
      method: "POST",
      body: JSON.stringify({ moduleId: "adults-budgeting-503020" })
    }, token);

    assert.equal(res.status, 200);
    assert.ok(res.data.streakDays >= 2);
  });
});

test("7. AI Coach & Age-Aware Insights", async (t) => {
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "riya@example.com", password: "password123" })
  });
  const token = login.data.token;

  await t.test("AI insights endpoint provides motivating adult insights", async () => {
    const res = await api("/api/ai-insights", { method: "GET" }, token);
    assert.equal(res.status, 200);
    assert.equal(res.data.tone, "motivating");
    assert.ok(res.data.insights.length > 0);
  });

  await t.test("AI suggestion adapts tone for kid / teen / adult", async () => {
    // Kid tone
    const kidRes = await api("/api/ai-suggestion", {
      method: "POST",
      body: JSON.stringify({
        amount: 100,
        age: 10,
        role: "child",
        accountMode: "family",
        studentName: "Leo"
      })
    });
    assert.equal(kidRes.data.tone, "playful");
    assert.equal(kidRes.data.explanation.includes("Woohoo"), true);

    // Adult tone
    const adultRes = await api("/api/ai-suggestion", {
      method: "POST",
      body: JSON.stringify({
        amount: 5000,
        age: 30,
        role: "individual",
        accountMode: "myself",
        studentName: "Riya"
      })
    });
    assert.equal(adultRes.data.tone, "motivating");
  });
});

test("8. Disclaimer Present on Endpoints", async () => {
  const health = await api("/api/health");
  assert.equal(health.data.disclaimer.includes("All balances are simulated; no real money is held or moved"), true);

  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "riya@example.com", password: "password123" })
  });
  const me = await api("/api/me", { method: "GET" }, login.data.token);
  assert.equal(me.data.disclaimer.includes("All balances are simulated; no real money is held or moved"), true);
});
