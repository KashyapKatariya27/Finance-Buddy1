import http from "http";
import { app } from "../src/index";
import { DISCLAIMER } from "@finance-buddy/shared";

interface TestContext {
  server: http.Server;
  baseUrl: string;
}

let ctx: TestContext;

function startServer(): Promise<TestContext> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address() as any;
      const baseUrl = `http://127.0.0.1:${address.port}`;
      resolve({ server, baseUrl });
    });
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
  } = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  const disclaimerHeader = res.headers.get("X-FinanceBuddy-Disclaimer");

  return {
    status: res.status,
    ok: res.ok,
    data,
    headers: res.headers,
    disclaimerHeader
  };
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests() {
  console.log("🚀 Starting FinanceBuddy E2E Test Suite (All 3 Account Modes)...");
  ctx = await startServer();
  const { baseUrl } = ctx;

  try {
    // TEST 1: Health check & Disclaimer header
    console.log("👉 Test 1: Health check & Disclaimer header...");
    const health = await request(baseUrl, "/api/health");
    assert(health.status === 200, "Health endpoint should return 200");
    assert(health.data.disclaimer === DISCLAIMER, "Health data must include simulated balance disclaimer");
    assert(health.disclaimerHeader === DISCLAIMER, "Header X-FinanceBuddy-Disclaimer must be present");
    console.log("  ✓ Health & Disclaimer verified");

    // TEST 2: Demo Logins (Sarah, Leo, Riya, Aman)
    console.log("👉 Test 2: Quick Demo accounts authentication...");
    const riyaLogin = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "riya@demo.com", password: "password123" }
    });
    assert(riyaLogin.status === 200, "Riya login should succeed");
    assert(riyaLogin.data.user.accountMode === "MYSELF", "Riya should be in MYSELF mode");
    assert(riyaLogin.data.user.role === "INDIVIDUAL", "Riya should have INDIVIDUAL role");
    assert(Boolean(riyaLogin.data.token), "Riya login should return JWT token");
    const riyaToken = riyaLogin.data.token;

    const sarahLogin = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "sarah@demo.com", password: "password123" }
    });
    assert(sarahLogin.status === 200, "Sarah login should succeed");
    assert(sarahLogin.data.user.accountMode === "FAMILY", "Sarah should be in FAMILY mode");
    assert(sarahLogin.data.user.role === "PARENT", "Sarah should have PARENT role");
    const sarahToken = sarahLogin.data.token;

    const leoLogin = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "leo@demo.com", password: "password123" }
    });
    assert(leoLogin.status === 200, "Leo login should succeed");
    assert(leoLogin.data.user.role === "CHILD", "Leo should have CHILD role");
    const leoToken = leoLogin.data.token;

    const amanLogin = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      body: { email: "aman@demo.com", password: "password123" }
    });
    assert(amanLogin.status === 200, "Aman login should succeed");
    assert(amanLogin.data.user.accountMode === "TEEN", "Aman should be in TEEN mode");
    assert(amanLogin.data.user.accountabilityPartnerEmail === "mentor@demo.com", "Aman should have partner email");
    const amanToken = amanLogin.data.token;
    console.log("  ✓ All 4 demo accounts authenticated successfully");

    // TEST 3: Mode Restriction: Minor cannot register Myself account
    console.log("👉 Test 3: Minor restriction (< 18 in Myself mode)...");
    const minorMyself = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Young Minor",
        email: "minor@test.com",
        password: "password123",
        accountMode: "MYSELF",
        age: 14
      }
    });
    assert(minorMyself.status === 400, "Minor registering Myself mode must be blocked (400)");
    console.log("  ✓ Under-18 restriction enforced for Myself mode");

    // TEST 4: Registration of a new Individual with Age-Aware preset (Young Adult, Age 22)
    console.log("👉 Test 4: Registration with Age-Aware presets...");
    const regIndividual = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Karan Patel",
        email: `karan_${Date.now()}@test.com`,
        password: "password123",
        accountMode: "MYSELF",
        role: "INDIVIDUAL",
        age: 22,
        currency: "INR"
      }
    });
    assert(regIndividual.status === 201, "Registration should succeed (201)");
    assert(regIndividual.data.user.split.everyday === 50, "Young Adult split everyday should be 50");
    assert(regIndividual.data.user.split.emergency === 20, "Young Adult split emergency should be 20");
    assert(regIndividual.data.user.split.savings === 30, "Young Adult split savings should be 30");
    const karanToken = regIndividual.data.token;
    console.log("  ✓ Registered with Young Adult preset 50/20/30");

    // TEST 5: Currency Switching
    console.log("👉 Test 5: Currency switching (INR <-> USD)...");
    const currSwitch = await request(baseUrl, "/api/dashboard/currency", {
      method: "POST",
      body: { currency: "USD" },
      token: karanToken
    });
    assert(currSwitch.status === 200, "Currency switch should succeed");
    assert(currSwitch.data.currency === "USD", "Currency should now be USD");
    console.log("  ✓ Currency dynamically switched to USD");

    // TEST 6: Emergency Vault Runway Guidance
    console.log("👉 Test 6: Emergency runway guidance calculation...");
    const dash = await request(baseUrl, "/api/dashboard", { token: riyaToken });
    assert(dash.status === 200, "Dashboard fetch should succeed");
    assert(dash.data.runway.targetMonthsMin === 3, "Runway minimum target must be 3 months");
    assert(dash.data.runway.targetMonthsMax === 6, "Runway maximum target must be 6 months");
    assert(typeof dash.data.runway.monthsCovered === "number", "Runway months covered must be calculated");
    console.log("  ✓ Emergency runway guidance calculated (3-6 months target)");

    // TEST 7: Goals CRUD & Auto-pacing calculations
    console.log("👉 Test 7: Goals creation and automatic pacing...");
    const newGoal = await request(baseUrl, "/api/goals", {
      method: "POST",
      body: {
        name: "Goa Weekend Getaway",
        category: "travel",
        targetAmount: 5000,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        priority: "high",
        icon: "🏖️",
        roundUpEnabled: true
      },
      token: karanToken
    });
    assert(newGoal.status === 201, "Goal creation should succeed (201)");
    const goalId = newGoal.data.goal.id;
    assert(newGoal.data.goal.pacing.requiredPerWeekCents > 0, "Required per week must be computed automatically");
    assert(newGoal.data.goal.pacing.requiredPerMonthCents > 0, "Required per month must be computed automatically");
    assert(newGoal.data.goal.pacing.milestones.m25 === false, "25% milestone should initially be false");
    console.log("  ✓ Goal created with automatic weekly/monthly pacing");

    // TEST 8: Manual Deposit & Milestone Unlocking
    console.log("👉 Test 8: Manual deposit and milestone progress...");
    const depRes = await request(baseUrl, `/api/goals/${goalId}/deposit`, {
      method: "POST",
      body: { amount: 1500 }, // 1,500 / 5,000 = 30% -> unlocks 25% milestone!
      token: karanToken
    });
    assert(depRes.status === 200, "Deposit should succeed");
    assert(depRes.data.goal.pacing.percent >= 25, "Progress should be >= 25%");
    assert(depRes.data.goal.pacing.milestones.m25 === true, "25% milestone should now be unlocked!");
    console.log("  ✓ Deposit made and 25% milestone badge unlocked");

    // TEST 9: Simulated Spend with Round-Up micro-savings
    console.log("👉 Test 9: Card purchase with round-up micro-savings...");
    const spendRes = await request(baseUrl, `/api/goals/${goalId}/simulate-spend`, {
      method: "POST",
      body: { spendAmount: 184.20, note: "Airport Coffee" },
      token: karanToken
    });
    assert(spendRes.status === 200, "Simulate spend should succeed");
    assert(spendRes.data.roundUpAmount > 0, "Spare change must be rounded up");
    console.log(`  ✓ Spent 184.20 with round-up of ${spendRes.data.roundUpAmount} credited to goal`);

    // TEST 10: Myself Mode Self-Discipline 24-Hour Cooling-Off Lock
    console.log("👉 Test 10: Myself mode self-discipline cooling-off lock...");
    const earlyWithdraw = await request(baseUrl, `/api/goals/${goalId}/withdraw`, {
      method: "POST",
      body: { amount: 500, reason: "Impulse concert ticket purchase" },
      token: karanToken
    });
    assert(earlyWithdraw.status === 200, "Withdrawal request should process");
    assert(earlyWithdraw.data.status === "cooling_off_initiated", "Should initiate 24h cooling-off lock");
    assert(earlyWithdraw.data.delayDays > 0, "Should compute how many days goal gets delayed");
    const coolingApprovalId = earlyWithdraw.data.approvalId;
    console.log(`  ✓ 24-Hour cooling lock initiated. Goal delayed by ~${earlyWithdraw.data.delayDays} days`);

    // Finalize cooling-off lock (with simulateBypass = true)
    const finalizeCooling = await request(baseUrl, `/api/approvals/${coolingApprovalId}/finalize-cooling-off`, {
      method: "POST",
      body: { simulateBypass: true },
      token: karanToken
    });
    assert(finalizeCooling.status === 200, "Cooling-off finalization should succeed");
    assert(finalizeCooling.data.approval.status === "completed", "Approval status should be completed");
    console.log("  ✓ Cooling-off period finalized and funds disbursed");

    // TEST 11: Teen Mode Accountability Partner Approval
    console.log("👉 Test 11: Teen mode accountability partner review...");
    // Aman has goal: M3 Pro Development Rig
    const amanGoals = await request(baseUrl, "/api/goals", { token: amanToken });
    assert(amanGoals.data.goals.length > 0, "Aman should have active goals");
    const amanGoal = amanGoals.data.goals[0];

    const teenEarlyWithdraw = await request(baseUrl, `/api/goals/${amanGoal.id}/withdraw`, {
      method: "POST",
      body: { amount: 2000, reason: "Buying gaming mouse" },
      token: amanToken
    });
    assert(teenEarlyWithdraw.data.status === "pending_partner_approval", "Should request partner approval");
    console.log("  ✓ Teen early withdrawal forwarded to accountability partner");

    // TEST 12: Family Mode Child Withdrawal & Parent Review
    console.log("👉 Test 12: Family mode parent approval review...");
    const leoGoals = await request(baseUrl, "/api/goals", { token: leoToken });
    assert(leoGoals.data.goals.length > 0, "Leo should have LEGO goal");
    const leoGoal = leoGoals.data.goals[0];

    const childEarlyWithdraw = await request(baseUrl, `/api/goals/${leoGoal.id}/withdraw`, {
      method: "POST",
      body: { amount: 15, reason: "Buying candy" },
      token: leoToken
    });
    assert(childEarlyWithdraw.data.status === "pending_parent_approval", "Child withdrawal must require parent approval");
    const childApprId = childEarlyWithdraw.data.approvalId;

    // Parent (Sarah) reviews and approves
    const reviewRes = await request(baseUrl, `/api/approvals/${childApprId}/review`, {
      method: "POST",
      body: { decision: "approved" },
      token: sarahToken
    });
    assert(reviewRes.status === 200, "Parent review should succeed");
    assert(reviewRes.data.approval.status === "approved", "Approval status should be approved");
    console.log("  ✓ Parent reviewed and approved child withdrawal");

    // TEST 13: Learning Hub & Streak Extension
    console.log("👉 Test 13: Learning hub modules & streak increment...");
    const learnRes = await request(baseUrl, "/api/learning", { token: riyaToken });
    assert(learnRes.status === 200, "Learning hub should return modules");
    assert(learnRes.data.modules.length >= 5, "Should have adult and teen modules");
    const adultModule = learnRes.data.modules.find((m: any) => m.id === "adults-1");
    assert(Boolean(adultModule), "Adult emergency module must exist");

    // Submit correct answer to earn reward and increment streak
    const quizRes = await request(baseUrl, "/api/learning/complete", {
      method: "POST",
      body: { moduleId: "adults-1", answerIndex: adultModule.quiz.correctIndex },
      token: riyaToken
    });
    assert(quizRes.status === 200, "Quiz submission should succeed");
    assert(quizRes.data.correct === true, "Answer should be correct");
    assert(quizRes.data.newStreak >= 22, "Streak should be incremented");
    console.log(`  ✓ Module completed. Streak extended to ${quizRes.data.newStreak} days 🔥`);

    // TEST 14: AI Coach Adaptation by Age and Mode
    console.log("👉 Test 14: AI Coach tone adaptation by age and role...");
    const aiKid = await request(baseUrl, "/api/ai/suggestion", {
      method: "POST",
      body: { query: "How do I save?" },
      token: leoToken
    });
    assert(aiKid.status === 200, "AI Kid response should succeed");
    assert(aiKid.data.advice.length > 10, "Should generate kid-friendly advice");

    const aiAdult = await request(baseUrl, "/api/ai/suggestion", {
      method: "POST",
      body: { query: "How do I optimize my goals?" },
      token: riyaToken
    });
    assert(aiAdult.status === 200, "AI Adult response should succeed");
    assert(aiAdult.data.advice.length > 10, "Should generate adult advice");
    console.log("  ✓ AI Coach adapted advice for both Kid and Adult");

    console.log("\n========================================================");
    console.log("🎉 ALL E2E TESTS PASSED WITH 100% SUCCESS!");
    console.log("========================================================\n");
    process.exit(0);
  } finally {
    if (ctx?.server) {
      await stopServer(ctx.server);
    }
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
