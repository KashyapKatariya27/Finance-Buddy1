"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { getAiSuggestion, computeGoalInsights, getToneForAge, formatCurrency } = require("./api/ai-suggestion.js");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_ROOT = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const production = process.env.NODE_ENV === "production";
const DISCLAIMER = "FinanceBuddy is a goal-planning and learning tool. All balances are simulated; no real money is held or moved.";

// Safe SESSION_SECRET initialization
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  if (production) {
    console.warn("⚠️  [FinanceBuddy] Warning: SESSION_SECRET is not set in environment variables.");
    console.warn("⚠️  [FinanceBuddy] Using an auto-generated secret. For persistent sessions across restarts, set SESSION_SECRET in Render's Environment settings.");
  } else {
    console.warn("ℹ️  [FinanceBuddy] SESSION_SECRET is not set; development sessions expire when the server restarts.");
  }
  SECRET = crypto.randomBytes(32).toString("hex");
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const dbFile = process.env.DATABASE_PATH || path.join(DATA_DIR, "finance-buddy.sqlite");
const db = new DatabaseSync(dbFile);

function migrateSchema() {
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

  // Ensure base users table exists
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'individual',
    parent_id INTEGER REFERENCES users(id),
    everyday_cents INTEGER NOT NULL DEFAULT 0,
    emergency_cents INTEGER NOT NULL DEFAULT 0,
    savings_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  // Check if users table needs CHECK constraint relaxation for 'individual'
  const usersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || "";
  if (usersSql.includes("CHECK(role IN ('parent','child'))") && !usersSql.includes("'individual'")) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE users_migrated (
        id INTEGER PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('parent','child','individual')),
        parent_id INTEGER REFERENCES users(id),
        everyday_cents INTEGER NOT NULL DEFAULT 0,
        emergency_cents INTEGER NOT NULL DEFAULT 0,
        savings_cents INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users_migrated (id, full_name, email, password_hash, role, parent_id, everyday_cents, emergency_cents, savings_cents, created_at)
        SELECT id, full_name, email, password_hash, role, parent_id, everyday_cents, emergency_cents, savings_cents, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_migrated RENAME TO users;
      PRAGMA foreign_keys = ON;
    `);
  }

  // Ensure missing columns on users
  const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  const userColDefs = [
    ["account_mode", "TEXT NOT NULL DEFAULT 'family'"],
    ["age", "INTEGER NOT NULL DEFAULT 25"],
    ["accountability_partner_email", "TEXT"],
    ["split_everyday", "INTEGER NOT NULL DEFAULT 50"],
    ["split_emergency", "INTEGER NOT NULL DEFAULT 20"],
    ["split_savings", "INTEGER NOT NULL DEFAULT 30"],
    ["currency", "TEXT NOT NULL DEFAULT 'INR'"],
    ["monthly_expenses_cents", "INTEGER NOT NULL DEFAULT 2000000"],
    ["streak_days", "INTEGER NOT NULL DEFAULT 1"],
    ["parent_id", "INTEGER REFERENCES users(id)"]
  ];
  for (const [col, def] of userColDefs) {
    if (!userColumns.includes(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
    }
  }

  // Ensure goals table exists
  db.exec(`CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    target_cents INTEGER NOT NULL,
    current_cents INTEGER NOT NULL DEFAULT 0,
    deadline TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    icon TEXT DEFAULT '🎯',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    auto_save_cents INTEGER NOT NULL DEFAULT 0,
    auto_save_frequency TEXT DEFAULT 'none',
    round_up_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  // Ensure transactions table exists
  db.exec(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  // Ensure approvals table exists
  db.exec(`CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES users(id),
    goal_id INTEGER REFERENCES goals(id),
    unlock_at TEXT,
    cooling_off INTEGER NOT NULL DEFAULT 0,
    partner_email TEXT,
    delay_days INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'allowance',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);

  const approvalColumns = db.prepare("PRAGMA table_info(approvals)").all().map(c => c.name);
  const approvalColDefs = [
    ["goal_id", "INTEGER REFERENCES goals(id)"],
    ["unlock_at", "TEXT"],
    ["cooling_off", "INTEGER NOT NULL DEFAULT 0"],
    ["partner_email", "TEXT"],
    ["delay_days", "INTEGER NOT NULL DEFAULT 0"],
    ["type", "TEXT NOT NULL DEFAULT 'allowance'"]
  ];
  for (const [col, def] of approvalColDefs) {
    if (!approvalColumns.includes(col)) {
      db.exec(`ALTER TABLE approvals ADD COLUMN ${col} ${def}`);
    }
  }

  // Ensure app_events and learning_progress exist
  db.exec(`CREATE TABLE IF NOT EXISTS app_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS learning_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    module_id TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, module_id)
  );
  CREATE INDEX IF NOT EXISTS approvals_parent_status_idx ON approvals(parent_id, status, id);
  CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS goals_user_idx ON goals(user_id, status);
  `);
}

migrateSchema();

function hash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(`${salt}:${key.toString("hex")}`))
  );
}

async function matches(password, stored) {
  const [salt, expected] = String(stored).split(":");
  if (!salt || !expected) return false;
  const actual = (await hash(password, salt)).split(":")[1], a = Buffer.from(actual, "hex"), b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function seedDemoAccounts() {
  const count = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (count > 0) return;

  const defaultPasswordHash = await hash("password123");

  // 1. Sarah Jenkins (Family Parent)
  const sarahResult = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, account_mode, age, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
    VALUES (?, ?, ?, 'parent', 'family', 38, 5000000, 15000000, 8000000, 50, 30, 20, 'INR', 4000000)
  `).run("Sarah Jenkins", "sarah@example.com", defaultPasswordHash);
  const sarahId = sarahResult.lastInsertRowid;

  // 2. Leo Jenkins (Family Child)
  const leoResult = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, account_mode, age, parent_id, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
    VALUES (?, ?, ?, 'child', 'family', 14, ?, 725000, 435000, 290000, 50, 30, 20, 'INR', 200000)
  `).run("Leo Jenkins", "leo@example.com", defaultPasswordHash, sarahId);
  const leoId = leoResult.lastInsertRowid;

  // Goal for Leo: Coding Laptop (₹12,000, current ₹9,600 -> 80%)
  db.prepare(`
    INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
    VALUES (?, 'Smart Coding Laptop', 'gadget', 1200000, 960000, '2026-12-20', 'high', '💻', 'active', 50000, 'weekly', 1)
  `).run(leoId);

  // 3. Riya Sharma (Individual Adult)
  const riyaResult = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, account_mode, age, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
    VALUES (?, ?, ?, 'individual', 'myself', 28, 3500000, 18000000, 9500000, 50, 30, 20, 'INR', 3000000)
  `).run("Riya Sharma", "riya@example.com", defaultPasswordHash);
  const riyaId = riyaResult.lastInsertRowid;

  // Goals for Riya
  db.prepare(`
    INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
    VALUES (?, 'Trip to Japan', 'travel', 15000000, 11250000, '2027-04-15', 'high', '✈️', 'active', 1000000, 'monthly', 1)
  `).run(riyaId);

  db.prepare(`
    INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
    VALUES (?, '6-Month Emergency Safety Net', 'emergency', 18000000, 18000000, '2026-12-31', 'high', '🛡️', 'completed', 0, 'none', 0)
  `).run(riyaId);

  // 4. Aman Verma (Teen / Student)
  const amanResult = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role, account_mode, age, accountability_partner_email, everyday_cents, emergency_cents, savings_cents, split_everyday, split_emergency, split_savings, currency, monthly_expenses_cents)
    VALUES (?, ?, ?, 'individual', 'teen', 17, 'mentor@example.com', 450000, 300000, 2750000, 50, 30, 20, 'INR', 500000)
  `).run("Aman Verma", "aman@example.com", defaultPasswordHash);
  const amanId = amanResult.lastInsertRowid;

  // Goal for Aman
  db.prepare(`
    INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, status, auto_save_cents, auto_save_frequency, round_up_enabled)
    VALUES (?, 'Study Laptop', 'gadget', 5500000, 2750000, '2027-01-31', 'high', '💻', 'active', 200000, 'monthly', 1)
  `).run(amanId);

  console.log("✅ Seed demo accounts initialized (Sarah, Leo, Riya, Aman).");
}

seedDemoAccounts().catch(console.error);

const attempts = new Map();
function headers(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}
function send(res, status, body, type = "application/json; charset=utf-8") {
  headers(res);
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
function bad(res, message, status = 400) { send(res, status, { error: message }); }
function requestError(message, status) { const error = new Error(message); error.status = status; error.expose = true; return error; }

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "", done = false;
    const fail = error => { if (!done) { done = true; reject(error); } };
    req.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > 200000) { fail(requestError("Request body is too large.", 413)); req.destroy(); }
    });
    req.on("end", () => {
      if (done) return;
      try { done = true; resolve(body ? JSON.parse(body) : {}); }
      catch { fail(requestError("Invalid JSON body.", 400)); }
    });
    req.on("error", () => fail(requestError("Could not read the request body.", 400)));
  });
}

function email(value) { return String(value || "").trim().toLowerCase(); }
function clean(value, max) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }
function cents(value) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 0;
  const amount = Math.round(Number(text) * 100);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 10000000000 ? amount : 0;
}

function tokenFor(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 604800000 })).toString("base64url");
  return `${payload}.${crypto.createHmac("sha256", SECRET).update(payload).digest("base64url")}`;
}

function currentUser(req) {
  const match = (req.headers.authorization || "").match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const [payload, signature] = match[1].split("."), expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isInteger(session.id) || session.exp < Date.now()) return null;
    return db.prepare("SELECT * FROM users WHERE id = ?").get(session.id) || null;
  } catch { return null; }
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) { bad(res, "Please sign in to continue.", 401); return null; }
  return user;
}

function getPresetForAge(age) {
  const a = Number(age) || 25;
  if (a <= 12) return { category: "child", name: "Child (6-12)", everyday: 50, emergency: 20, savings: 30 };
  if (a <= 17) return { category: "teen", name: "Teen (13-17)", everyday: 50, emergency: 30, savings: 20 };
  if (a <= 25) return { category: "young_adult", name: "Young Adult (18-25)", everyday: 50, emergency: 20, savings: 30 };
  return { category: "adult", name: "Adult (26+)", everyday: 50, emergency: 30, savings: 20 };
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    accountMode: user.account_mode || "family",
    age: user.age || 25,
    currency: user.currency || "INR",
    parentLinked: Boolean(user.parent_id),
    accountabilityPartnerEmail: user.accountability_partner_email || null,
    splitEveryday: user.split_everyday ?? 50,
    splitEmergency: user.split_emergency ?? 20,
    splitSavings: user.split_savings ?? 30,
    monthlyExpensesCents: user.monthly_expenses_cents || 2000000,
    streakDays: user.streak_days || 1,
    disclaimer: DISCLAIMER
  };
}

function enrichGoal(goal) {
  const target = goal.target_cents;
  const current = goal.current_cents;
  const remaining = Math.max(0, target - current);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  const now = Date.now();
  const deadlineDate = new Date(goal.deadline + "T23:59:59Z").getTime();
  const daysRemaining = Math.max(1, Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24)));
  const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  const monthsRemaining = Math.max(0.5, daysRemaining / 30.4);

  const reqPerWeek = Math.round(remaining / weeksRemaining);
  const reqPerMonth = Math.round(remaining / monthsRemaining);

  const milestones = {
    m25: percent >= 25,
    m50: percent >= 50,
    m75: percent >= 75,
    m100: percent >= 100
  };

  let onTrackStatus = "on_track";
  let daysAheadOrBehind = 0;
  if (percent >= 100) {
    onTrackStatus = "completed";
  } else {
    const createdDate = new Date(goal.created_at || Date.now()).getTime();
    const totalDays = Math.max(1, Math.ceil((deadlineDate - createdDate) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(1, Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24)));
    const expectedPercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

    if (percent < expectedPercent - 10) {
      onTrackStatus = "behind";
      daysAheadOrBehind = -Math.round(((expectedPercent - percent) / 100) * totalDays);
    } else if (percent > expectedPercent + 15) {
      onTrackStatus = "ahead";
      daysAheadOrBehind = Math.round(((percent - expectedPercent) / 100) * totalDays);
    }
  }

  let projectedDate = goal.deadline;
  if (percent >= 100) {
    projectedDate = new Date().toISOString().split("T")[0];
  } else if (daysAheadOrBehind > 0) {
    const projTime = deadlineDate - (daysAheadOrBehind * 24 * 60 * 60 * 1000);
    projectedDate = new Date(Math.max(now, projTime)).toISOString().split("T")[0];
  }

  return {
    id: goal.id,
    userId: goal.user_id,
    name: goal.name,
    category: goal.category,
    targetCents: goal.target_cents,
    currentCents: goal.current_cents,
    target: goal.target_cents,
    current: goal.current_cents,
    deadline: goal.deadline,
    priority: goal.priority,
    icon: goal.icon || "🎯",
    status: percent >= 100 ? "completed" : goal.status,
    autoSaveCents: goal.auto_save_cents || 0,
    autoSaveFrequency: goal.auto_save_frequency || "none",
    roundUpEnabled: Boolean(goal.round_up_enabled),
    progressPercentage: percent,
    remainingCents: remaining,
    requiredPerWeekCents: reqPerWeek,
    requiredPerMonthCents: reqPerMonth,
    daysRemaining,
    onTrackStatus,
    daysAheadOrBehind,
    projectedCompletionDate: projectedDate,
    milestones,
    isCompleted: percent >= 100,
    createdAt: goal.created_at
  };
}

function limited(req) {
  const key = `${req.socket.remoteAddress}:${new URL(req.url, "http://localhost").pathname}`, now = Date.now(), recent = (attempts.get(key) || []).filter(time => now - time < 600000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > 25;
}

// Learning modules catalog
const LEARNING_MODULES = [
  // Kids
  {
    id: "kids-needs-wants",
    level: "Kids",
    title: "Needs vs. Wants: The Gold Standard",
    description: "Understanding core spend metrics before committing savings plans.",
    tag: "Need Guard Expert",
    points: 50,
    icon: "✓"
  },
  {
    id: "kids-piggy-wallet",
    level: "Kids",
    title: "From Piggy Bank to Digital Wallet",
    description: "How digital money works and why it feels different than physical cash.",
    tag: "Junior Saver",
    points: 50,
    icon: "🐷"
  },
  // Teens
  {
    id: "teens-compound-magic",
    level: "Teens",
    title: "The Compound Growth Magic Engine",
    description: "How visual goals grow exponentially through systematic micro-deposits.",
    tag: "Savings Alchemist",
    points: 75,
    icon: "📈"
  },
  {
    id: "teens-avoid-scams",
    level: "Teens",
    title: "Spotting the Trap: Internet Scams & Security",
    description: "Protect cards, identify phishing links, and lock passwords safely away.",
    tag: "Web Shield Apprentice",
    points: 75,
    icon: "🛡️"
  },
  // Adults
  {
    id: "adults-budgeting-503020",
    level: "Adults",
    title: "Modern Budgeting & The 50/30/20 Rule",
    description: "Structure everyday expenses, emergency reserves, and long-term goal funds.",
    tag: "Budget Master",
    points: 100,
    icon: "📊"
  },
  {
    id: "adults-emergency-fund",
    level: "Adults",
    title: "Emergency Funds: 3-6 Months Liquid Runway",
    description: "Calculating your non-negotiable living expenses and placing funds safely.",
    tag: "Resilience Guard",
    points: 100,
    icon: "🔒"
  },
  {
    id: "adults-sip-basics",
    level: "Adults",
    title: "SIP Basics & Systematic Compounding",
    description: "How small regular monthly investments smooth volatility and build wealth.",
    tag: "Wealth Builder",
    points: 100,
    icon: "🌱"
  },
  {
    id: "adults-debt-management",
    level: "Adults",
    title: "Debt Basics: Good vs. Bad Debt & Repayment",
    description: "Mastering interest rates, snowball vs. avalanche strategies, and credit scores.",
    tag: "Debt Free Hero",
    points: 100,
    icon: "💳"
  },
  {
    id: "adults-scam-prevention",
    level: "Adults",
    title: "Financial Scams: Ponzi Schemes & QR Code Traps",
    description: "Recognize high-yield fraud, unauthorized mandates, and social engineering.",
    tag: "Security Specialist",
    points: 100,
    icon: "🚨"
  }
];

async function api(req, res, pathname) {
  if (pathname === "/api/health") {
    return send(res, 200, {
      status: "ok",
      app: "FinanceBuddy",
      version: "2.0-goal-first",
      disclaimer: DISCLAIMER,
      timestamp: new Date().toISOString()
    });
  }

  // AI suggestion endpoint
  if (req.method === "POST" && pathname === "/api/ai-suggestion") {
    try {
      const body = await parseJson(req);
      const user = currentUser(req);
      const userAge = body.age || user?.age || 25;
      const userRole = body.role || user?.role || "individual";
      const userMode = body.accountMode || user?.account_mode || "myself";
      const userCurrency = body.currency || user?.currency || "INR";

      const userGoals = user
        ? db.prepare("SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC").all(user.id).map(enrichGoal)
        : [];

      const suggestion = await getAiSuggestion({
        amount: body.amount,
        splitPercentages: body.splitPercentages || {
          everydayPct: user?.split_everyday ?? 50,
          emergencyPct: user?.split_emergency ?? 20,
          savingPct: user?.split_savings ?? 30
        },
        studentName: body.studentName || user?.full_name || "Saver",
        age: userAge,
        role: userRole,
        accountMode: userMode,
        currency: userCurrency,
        goals: userGoals,
        emergencyFundMonths: user && user.monthly_expenses_cents > 0 ? (user.emergency_cents / user.monthly_expenses_cents).toFixed(1) : null
      });
      return send(res, 200, suggestion);
    } catch (err) {
      return bad(res, err.message || "Failed to generate AI suggestion.", err.status || 400);
    }
  }

  // AI insights endpoint
  if (req.method === "GET" && pathname === "/api/ai-insights") {
    const user = requireUser(req, res);
    if (!user) return;
    const goals = db.prepare("SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY id DESC").all(user.id).map(enrichGoal);
    const months = user.monthly_expenses_cents > 0 ? Number((user.emergency_cents / user.monthly_expenses_cents).toFixed(1)) : 0;
    const insights = computeGoalInsights(goals, user.currency || "INR");
    const tone = getToneForAge(user.age, user.role, user.account_mode);

    if (months >= 6) {
      insights.unshift(`🛡️ Excellent! Your emergency vault covers ${months} months of expenses. You have a rock-solid buffer.`);
    } else if (months >= 3) {
      insights.unshift(`🛡️ Good safety buffer (${months} months covered). Consider expanding toward 6 months for complete peace of mind.`);
    } else {
      insights.unshift(`💡 Emergency guidance: Target 3-6 months of living expenses (currently ${months} months covered).`);
    }

    return send(res, 200, {
      insights,
      tone,
      currency: user.currency || "INR",
      disclaimer: DISCLAIMER
    });
  }

  if ((pathname === "/api/auth/login" || pathname === "/api/auth/register") && limited(req)) {
    return bad(res, "Too many attempts. Please try again in a few minutes.", 429);
  }

  // Auth: Register (Supports 3 Modes: family, myself, teen)
  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await parseJson(req);
    const fullName = clean(body.fullName, 100);
    const address = email(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const accountMode = ["family", "myself", "teen"].includes(body.accountMode) ? body.accountMode : "family";
    const age = Number.isInteger(Number(body.age)) && Number(body.age) > 0 ? Number(body.age) : (accountMode === "teen" ? 16 : (accountMode === "family" && body.role === "child" ? 12 : 25));
    const currency = ["INR", "USD"].includes(body.currency) ? body.currency : "INR";

    if (fullName.length < 2) return bad(res, "Enter a name with at least 2 characters.");
    if (!/^\S+@\S+\.\S+$/.test(address)) return bad(res, "Enter a valid email address.");
    if (password.length < 6 || password.length > 200) return bad(res, "Password must be at least 6 characters.");

    let role = "individual";
    let parent = null;
    let partnerEmail = null;

    if (accountMode === "family") {
      role = body.role === "child" ? "child" : "parent";
      if (role === "child") {
        const parentAddress = email(body.parentEmail);
        if (!parentAddress) return bad(res, "Enter the email address of your registered parent account.");
        parent = db.prepare("SELECT id, role FROM users WHERE email = ?").get(parentAddress);
        if (!parent || parent.role !== "parent") return bad(res, "No parent account was found for that email address.");
      }
    } else if (accountMode === "myself") {
      role = "individual";
      if (age < 18) {
        return bad(res, "Children under 18 must always stay under a guardian. Please register under Family or Teen mode.");
      }
    } else if (accountMode === "teen") {
      role = "individual";
      if (body.accountabilityPartnerEmail) {
        partnerEmail = email(body.accountabilityPartnerEmail);
      }
    }

    const preset = getPresetForAge(age);
    const splitEveryday = preset.everyday;
    const splitEmergency = preset.emergency;
    const splitSavings = preset.savings;

    try {
      const result = db.prepare(`
        INSERT INTO users (full_name, email, password_hash, role, account_mode, age, parent_id, accountability_partner_email, split_everyday, split_emergency, split_savings, currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fullName,
        address,
        await hash(password),
        role,
        accountMode,
        age,
        parent?.id || null,
        partnerEmail,
        splitEveryday,
        splitEmergency,
        splitSavings,
        currency
      );

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
      const redirectTo = role === "child" ? "/kids" : "/dashboard";
      return send(res, 201, {
        token: tokenFor(user),
        user: publicUser(user),
        redirectTo
      });
    } catch (error) {
      return bad(res, String(error.message).includes("UNIQUE") ? "An account already exists for this email." : "Could not create account.");
    }
  }

  // Auth: Login
  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await parseJson(req);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email(body.email));
    if (!user || !(await matches(typeof body.password === "string" ? body.password : "", user.password_hash))) {
      return bad(res, "Email or password is incorrect.", 401);
    }
    const redirectTo = user.role === "child" ? "/kids" : "/dashboard";
    return send(res, 200, {
      token: tokenFor(user),
      user: publicUser(user),
      redirectTo
    });
  }

  // User info
  if (req.method === "GET" && pathname === "/api/me") {
    const user = requireUser(req, res);
    if (user) send(res, 200, { user: publicUser(user), disclaimer: DISCLAIMER });
    return;
  }

  // Currency toggle/update
  if (req.method === "POST" && pathname === "/api/currency") {
    const user = requireUser(req, res);
    if (!user) return;
    const { currency } = await parseJson(req);
    if (!["INR", "USD"].includes(currency)) return bad(res, "Currency must be INR or USD.");
    db.prepare("UPDATE users SET currency = ? WHERE id = ?").run(currency, user.id);
    return send(res, 200, { message: `Currency set to ${currency}.`, currency });
  }

  // Dashboard data
  if (req.method === "GET" && pathname === "/api/dashboard") {
    const user = requireUser(req, res);
    if (!user) return;

    // Check approvals pending for parent or accountability partner
    let pending = null;
    if (user.role === "parent") {
      pending = db.prepare("SELECT id, amount_cents, reason, child_id FROM approvals WHERE parent_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(user.id);
    } else {
      pending = db.prepare("SELECT id, amount_cents, reason, child_id FROM approvals WHERE partner_email = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(user.email);
    }

    // Cooling off requests for current user
    const coolingOff = db.prepare("SELECT id, amount_cents, reason, unlock_at, delay_days, goal_id FROM approvals WHERE child_id = ? AND status = 'cooling_off' ORDER BY id DESC").all(user.id);

    // Active goals
    const goals = db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC").all(user.id).map(enrichGoal);

    const total = user.everyday_cents + user.emergency_cents + user.savings_cents;
    const monthlyExpenses = user.monthly_expenses_cents || 2000000;
    const monthsCovered = Number((user.emergency_cents / monthlyExpenses).toFixed(1));

    return send(res, 200, {
      user: publicUser(user),
      balances: {
        everyday: user.everyday_cents,
        emergency: user.emergency_cents,
        savings: user.savings_cents,
        total
      },
      emergencyGuidance: {
        monthlyExpenses,
        monthsCovered,
        target3Months: monthlyExpenses * 3,
        target6Months: monthlyExpenses * 6,
        status: monthsCovered >= 6 ? "Fully Funded (6+ Mos)" : monthsCovered >= 3 ? "Healthy Buffer (3-6 Mos)" : "Building Reserve (< 3 Mos)"
      },
      planSplit: {
        everyday: user.split_everyday ?? 50,
        emergency: user.split_emergency ?? 20,
        savings: user.split_savings ?? 30,
        preset: getPresetForAge(user.age)
      },
      goals,
      pendingApproval: pending ? { id: pending.id, amount: pending.amount_cents, reason: pending.reason } : null,
      coolingOffRequests: coolingOff.map(r => ({
        id: r.id,
        amount: r.amount_cents,
        reason: r.reason,
        unlockAt: r.unlock_at,
        delayDays: r.delay_days,
        goalId: r.goal_id,
        isUnlocked: new Date(r.unlock_at).getTime() <= Date.now()
      })),
      disclaimer: DISCLAIMER
    });
  }

  // Plan Split Update (for Individuals and Parents)
  if (req.method === "POST" && pathname === "/api/plan-split") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await parseJson(req);
    const everyday = Number(body.everyday);
    const emergency = Number(body.emergency);
    const savings = Number(body.savings);

    if (
      !Number.isInteger(everyday) || everyday < 0 ||
      !Number.isInteger(emergency) || emergency < 0 ||
      !Number.isInteger(savings) || savings < 0 ||
      everyday + emergency + savings !== 100
    ) {
      return bad(res, "Split percentages must be integers summing to 100%.");
    }

    db.prepare("UPDATE users SET split_everyday = ?, split_emergency = ?, split_savings = ? WHERE id = ?").run(everyday, emergency, savings, user.id);
    return send(res, 200, {
      message: `Plan split updated: ${everyday}% Everyday, ${emergency}% Emergency, ${savings}% Savings.`,
      split: { everyday, emergency, savings }
    });
  }

  // GOALS API: List & Create
  if (pathname === "/api/goals" && req.method === "GET") {
    const user = requireUser(req, res);
    if (!user) return;
    const goals = db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC").all(user.id).map(enrichGoal);
    return send(res, 200, { goals, disclaimer: DISCLAIMER });
  }

  if (pathname === "/api/goals" && req.method === "POST") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await parseJson(req);
    const name = clean(body.name, 100);
    const category = clean(body.category || "other", 40);
    const target = cents(body.targetAmount);
    const deadline = String(body.deadline || "").trim();
    const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
    const icon = clean(body.icon || "🎯", 10);
    const autoSaveCents = cents(body.autoSaveAmount || 0);
    const autoSaveFrequency = ["none", "weekly", "monthly", "percent_income"].includes(body.autoSaveFrequency) ? body.autoSaveFrequency : "none";
    const roundUpEnabled = body.roundUpEnabled ? 1 : 0;

    if (name.length < 2) return bad(res, "Enter a goal name with at least 2 characters.");
    if (!target || target <= 0) return bad(res, "Target amount must be greater than 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return bad(res, "Deadline must be in YYYY-MM-DD format.");

    const result = db.prepare(`
      INSERT INTO goals (user_id, name, category, target_cents, current_cents, deadline, priority, icon, auto_save_cents, auto_save_frequency, round_up_enabled)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(user.id, name, category, target, deadline, priority, icon, autoSaveCents, autoSaveFrequency, roundUpEnabled);

    const goal = enrichGoal(db.prepare("SELECT * FROM goals WHERE id = ?").get(result.lastInsertRowid));
    return send(res, 201, { message: `Goal "${name}" created!`, goal });
  }

  // GOAL: Deposit into Goal
  if (req.method === "POST" && /^\/api\/goals\/\d+\/deposit$/.test(pathname)) {
    const user = requireUser(req, res);
    if (!user) return;
    const goalId = Number(pathname.split("/")[3]);
    const body = await parseJson(req);
    const amount = cents(body.amount);

    if (!amount || amount <= 0) return bad(res, "Enter a valid positive deposit amount.");

    const goal = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(goalId, user.id);
    if (!goal) return bad(res, "Goal not found.", 404);

    if (user.everyday_cents < amount) {
      return bad(res, "Insufficient balance in Everyday wallet to deposit into this goal.", 400);
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE users SET everyday_cents = everyday_cents - ?, savings_cents = savings_cents + ? WHERE id = ?").run(amount, amount, user.id);
      db.prepare("UPDATE goals SET current_cents = current_cents + ? WHERE id = ?").run(amount, goalId);
      db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'goal_deposit', ?, ?)").run(
        user.id,
        amount,
        `Deposit to goal: ${goal.name}`
      );

      const updatedGoal = enrichGoal(db.prepare("SELECT * FROM goals WHERE id = ?").get(goalId));
      if (updatedGoal.currentCents >= updatedGoal.targetCents && goal.current_cents < goal.target_cents) {
        db.prepare("UPDATE goals SET status = 'completed' WHERE id = ?").run(goalId);
        updatedGoal.status = "completed";
      }

      db.exec("COMMIT");

      return send(res, 200, {
        message: `Deposited ${formatCurrency(amount, user.currency)} into "${goal.name}".`,
        goal: updatedGoal,
        milestones: updatedGoal.milestones
      });
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch {}
      throw err;
    }
  }

  // GOAL: Simulate spend with round-up savings
  if (req.method === "POST" && /^\/api\/goals\/\d+\/simulate-spend$/.test(pathname)) {
    const user = requireUser(req, res);
    if (!user) return;
    const goalId = Number(pathname.split("/")[3]);
    const body = await parseJson(req);
    const spend = cents(body.spendAmount);
    const note = clean(body.note || "Simulated Card Purchase", 100);

    if (!spend || spend <= 0) return bad(res, "Enter a valid spend amount.");
    const goal = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(goalId, user.id);
    if (!goal) return bad(res, "Goal not found.", 404);

    // Round up calculation: to the next ₹10 (1000 cents) or ₹100
    const remainder = spend % 1000;
    const roundUpAmount = remainder === 0 ? 0 : (1000 - remainder);
    const totalDeduction = spend + roundUpAmount;

    if (user.everyday_cents < totalDeduction) {
      return bad(res, "Insufficient balance in Everyday wallet for this purchase and round-up.", 400);
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE users SET everyday_cents = everyday_cents - ? WHERE id = ?").run(totalDeduction, user.id);
      if (roundUpAmount > 0) {
        db.prepare("UPDATE users SET savings_cents = savings_cents + ? WHERE id = ?").run(roundUpAmount, user.id);
        db.prepare("UPDATE goals SET current_cents = current_cents + ? WHERE id = ?").run(roundUpAmount, goalId);
      }

      db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'spend', ?, ?)").run(user.id, spend, note);
      if (roundUpAmount > 0) {
        db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'round_up', ?, ?)").run(
          user.id,
          roundUpAmount,
          `Round-up saved to ${goal.name}`
        );
      }

      const updatedGoal = enrichGoal(db.prepare("SELECT * FROM goals WHERE id = ?").get(goalId));
      db.exec("COMMIT");

      return send(res, 200, {
        message: `Spent ${formatCurrency(spend, user.currency)}! Saved ${formatCurrency(roundUpAmount, user.currency)} round-up into "${goal.name}".`,
        roundUpSaved: roundUpAmount,
        goal: updatedGoal
      });
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch {}
      throw err;
    }
  }

  // GOAL: Withdraw (Goal Completion or Early Withdrawal with Self-Discipline Lock)
  if (req.method === "POST" && /^\/api\/goals\/\d+\/withdraw$/.test(pathname)) {
    const user = requireUser(req, res);
    if (!user) return;
    const goalId = Number(pathname.split("/")[3]);
    const body = await parseJson(req);
    const amount = cents(body.amount);
    const reason = clean(body.reason || "Early Goal Withdrawal", 300);

    const goal = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(goalId, user.id);
    if (!goal) return bad(res, "Goal not found.", 404);
    if (!amount || amount <= 0) return bad(res, "Enter a positive withdrawal amount.");
    if (goal.current_cents < amount) return bad(res, "Requested amount exceeds currently saved balance in this goal.", 400);

    const isGoalAchieved = goal.current_cents >= goal.target_cents;

    // CASE 1: Goal achieved! Free withdrawal without locks or delays
    if (isGoalAchieved) {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare("UPDATE goals SET current_cents = current_cents - ? WHERE id = ?").run(amount, goalId);
        db.prepare("UPDATE users SET savings_cents = savings_cents - ?, everyday_cents = everyday_cents + ? WHERE id = ?").run(amount, amount, user.id);
        db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'goal_withdraw', ?, ?)").run(
          user.id,
          amount,
          `Goal Achieved Withdrawal: ${goal.name}`
        );
        const updatedGoal = enrichGoal(db.prepare("SELECT * FROM goals WHERE id = ?").get(goalId));
        db.exec("COMMIT");
        return send(res, 200, {
          completed: true,
          message: `🎉 Goal achieved! ${formatCurrency(amount, user.currency)} has been moved to your everyday wallet!`,
          goal: updatedGoal
        });
      } catch (err) {
        try { db.exec("ROLLBACK"); } catch {}
        throw err;
      }
    }

    // CASE 2: Early withdrawal before goal target is achieved
    if (reason.length < 4) {
      return bad(res, "Please provide a valid reason for early withdrawal (at least 4 characters).");
    }

    // Calculate how many days the goal gets delayed
    const now = Date.now();
    const deadlineDate = new Date(goal.deadline + "T23:59:59Z").getTime();
    const createdDate = new Date(goal.created_at || now).getTime();
    const totalDays = Math.max(1, Math.ceil((deadlineDate - createdDate) / (1000 * 60 * 60 * 24)));
    const delayDays = Math.max(1, Math.round((amount / Math.max(1, goal.target_cents)) * totalDays));

    // Subcase 2A: Child in Family Mode -> Parent approval required
    if (user.role === "child" && user.parent_id) {
      db.prepare(`
        INSERT INTO approvals (child_id, parent_id, amount_cents, reason, status, goal_id, delay_days, type)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, 'early_goal_withdrawal')
      `).run(user.id, user.parent_id, amount, reason, goalId, delayDays);
      return send(res, 201, {
        requiresParentApproval: true,
        delayDays,
        message: `Early withdrawal request submitted to your guardian. It will delay your goal by approx ${delayDays} days.`
      });
    }

    // Subcase 2B: Accountability Partner configured -> Partner approval required
    if (user.accountability_partner_email) {
      db.prepare(`
        INSERT INTO approvals (child_id, amount_cents, reason, status, goal_id, partner_email, delay_days, type)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, 'early_goal_withdrawal')
      `).run(user.id, amount, reason, goalId, user.accountability_partner_email, delayDays);
      return send(res, 201, {
        requiresPartnerApproval: true,
        partnerEmail: user.accountability_partner_email,
        delayDays,
        message: `Early withdrawal request sent to accountability partner (${user.accountability_partner_email}). It will delay your goal by approx ${delayDays} days.`
      });
    }

    // Subcase 2C: Pure Individual self-discipline lock -> 24-hour cooling-off period
    const unlockTime = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      INSERT INTO approvals (child_id, amount_cents, reason, status, goal_id, unlock_at, cooling_off, delay_days, type)
      VALUES (?, ?, ?, 'cooling_off', ?, ?, 1, ?, 'early_goal_withdrawal')
    `).run(user.id, amount, reason, goalId, unlockTime, delayDays);

    return send(res, 201, {
      coolingOff: true,
      approvalId: result.lastInsertRowid,
      unlockAt: unlockTime,
      delayDays,
      message: `Self-discipline lock active: 24-hour cooling-off period initiated. This withdrawal delays your goal by ${delayDays} days.`
    });
  }

  // GOAL: Finalize early withdrawal after cooling-off period
  if (req.method === "POST" && /^\/api\/approvals\/\d+\/finalize-cooling-off$/.test(pathname)) {
    const user = requireUser(req, res);
    if (!user) return;
    const approvalId = Number(pathname.split("/")[3]);
    const body = await parseJson(req);

    const approval = db.prepare("SELECT * FROM approvals WHERE id = ? AND child_id = ? AND status = 'cooling_off'").get(approvalId, user.id);
    if (!approval) return bad(res, "No active cooling-off request found.", 404);

    const isUnlocked = new Date(approval.unlock_at).getTime() <= Date.now() || Boolean(body.simulate_bypass);
    if (!isUnlocked) {
      const remainingMs = new Date(approval.unlock_at).getTime() - Date.now();
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      return bad(res, `Cooling-off period is still active. Please wait ${remainingHours} more hours before withdrawing.`, 403);
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      const goal = db.prepare("SELECT * FROM goals WHERE id = ?").get(approval.goal_id);
      if (goal && goal.current_cents >= approval.amount_cents) {
        db.prepare("UPDATE goals SET current_cents = current_cents - ? WHERE id = ?").run(approval.amount_cents, approval.goal_id);
      }
      db.prepare("UPDATE users SET savings_cents = MAX(0, savings_cents - ?), everyday_cents = everyday_cents + ? WHERE id = ?").run(approval.amount_cents, approval.amount_cents, user.id);
      db.prepare("UPDATE approvals SET status = 'completed' WHERE id = ?").run(approvalId);
      db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'early_withdraw', ?, ?)").run(
        user.id,
        approval.amount_cents,
        `Cooling-off finalized: ${approval.reason} (Delayed goal by ${approval.delay_days} days)`
      );
      db.exec("COMMIT");
      return send(res, 200, {
        message: `Cooling-off complete: ${formatCurrency(approval.amount_cents, user.currency)} released to your Everyday wallet.`
      });
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch {}
      throw err;
    }
  }

  // Learning Hub catalog & progress
  if (req.method === "GET" && pathname === "/api/learning") {
    const user = requireUser(req, res);
    if (!user) return;
    const progress = db.prepare("SELECT module_id, completed FROM learning_progress WHERE user_id = ?").all(user.id);
    const completedSet = new Set(progress.filter(p => p.completed).map(p => p.module_id));

    const defaultLevel = user.role === "child" || user.age <= 12 ? "Kids" : (user.account_mode === "teen" || user.age <= 17 ? "Teens" : "Adults");

    const modules = LEARNING_MODULES.map(m => ({
      ...m,
      isCompleted: completedSet.has(m.id)
    }));

    return send(res, 200, {
      modules,
      defaultLevel,
      streakDays: user.streak_days || 1,
      disclaimer: DISCLAIMER
    });
  }

  // Complete a learning challenge/module
  if (req.method === "POST" && pathname === "/api/learning/complete") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await parseJson(req);
    const moduleId = clean(body.moduleId, 60);
    if (!moduleId) return bad(res, "Module ID is required.");

    db.prepare(`
      INSERT INTO learning_progress (user_id, module_id, completed, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, module_id) DO UPDATE SET completed = 1, updated_at = CURRENT_TIMESTAMP
    `).run(user.id, moduleId);

    db.prepare("UPDATE users SET streak_days = streak_days + 1 WHERE id = ?").run(user.id);

    return send(res, 200, {
      message: "Challenge completed! Streak updated.",
      streakDays: (user.streak_days || 1) + 1
    });
  }

  // Events logging
  if (req.method === "POST" && pathname === "/api/events") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await parseJson(req), action = clean(body.action, 80);
    if (!action) return bad(res, "An action name is required.");
    db.prepare("INSERT INTO app_events (user_id, action, details) VALUES (?, ?, ?)").run(user.id, action, clean(body.details, 500));
    return send(res, 201, { message: "Action saved." });
  }

  // Children list (Parent view)
  if (req.method === "GET" && pathname === "/api/children") {
    const user = requireUser(req, res);
    if (!user) return;
    if (user.role !== "parent") return bad(res, "Only a parent can view linked child accounts.", 403);
    const children = db.prepare("SELECT * FROM users WHERE parent_id = ? ORDER BY full_name").all(user.id).map(child => ({
      id: child.id,
      fullName: child.full_name,
      email: child.email,
      balances: { everyday: child.everyday_cents, emergency: child.emergency_cents, savings: child.savings_cents, total: child.everyday_cents + child.emergency_cents + child.savings_cents },
      createdAt: child.created_at
    }));
    return send(res, 200, { children });
  }

  // Transactions list
  if (req.method === "GET" && pathname === "/api/transactions") {
    const user = requireUser(req, res);
    if (!user) return;
    const rows = user.role === "parent"
      ? db.prepare("SELECT t.id, t.type, t.amount_cents, t.note, t.created_at, u.full_name FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.user_id = ? OR u.parent_id = ? ORDER BY t.id DESC LIMIT 100").all(user.id, user.id)
      : db.prepare("SELECT t.id, t.type, t.amount_cents, t.note, t.created_at, u.full_name FROM transactions t JOIN users u ON u.id = t.user_id WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 100").all(user.id);
    return send(res, 200, {
      transactions: rows.map(row => ({ id: row.id, type: row.type, amount: row.amount_cents, note: row.note, createdAt: row.created_at, accountName: row.full_name })),
      currency: user.currency || "INR",
      disclaimer: DISCLAIMER
    });
  }

  // Wallet Funding (Parent or Individual)
  if (req.method === "POST" && pathname === "/api/funds") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await parseJson(req), amount = cents(body.amount);
    if (!amount) return bad(res, "Enter a positive amount with no more than two decimal places.");

    const everydayPct = user.split_everyday ?? 50;
    const emergencyPct = user.split_emergency ?? 20;
    const everyday = Math.round((amount * everydayPct) / 100);
    const emergency = Math.round((amount * emergencyPct) / 100);
    const savings = amount - everyday - emergency;

    db.prepare("UPDATE users SET everyday_cents = everyday_cents + ?, emergency_cents = emergency_cents + ?, savings_cents = savings_cents + ? WHERE id = ?").run(everyday, emergency, savings, user.id);
    db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'fund', ?, ?)").run(user.id, amount, clean(body.note || "Wallet funded", 200));

    return send(res, 201, {
      message: `Wallet funded and allocated (${everydayPct}% Everyday / ${emergencyPct}% Emergency / ${100 - everydayPct - emergencyPct}% Savings).`
    });
  }

  // Approvals: Child requests
  if (req.method === "POST" && pathname === "/api/approvals") {
    const user = requireUser(req, res);
    if (!user) return;
    const body = await parseJson(req), amount = cents(body.amount), reason = clean(body.reason, 300);
    if (!amount || reason.length < 4) return bad(res, "Include a positive amount and a short reason.");

    if (user.role === "child" && !user.parent_id) return bad(res, "Link this child account to a parent before submitting a request.", 409);

    const partner = user.accountability_partner_email || null;
    const parentId = user.parent_id || null;

    db.prepare("INSERT INTO approvals (child_id, parent_id, amount_cents, reason, partner_email) VALUES (?, ?, ?, ?, ?)").run(user.id, parentId, amount, reason, partner);
    return send(res, 201, { message: "Your request is ready for review." });
  }

  // Approvals: Review by Parent or Accountability Partner
  if (req.method === "POST" && /^\/api\/approvals\/\d+\/review$/.test(pathname)) {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(pathname.split("/")[3]);
    const { decision } = await parseJson(req);
    if (!["approved", "rejected"].includes(decision)) return bad(res, "Choose approved or rejected.");

    db.exec("BEGIN IMMEDIATE");
    try {
      const approval = db.prepare("SELECT * FROM approvals WHERE id = ? AND (parent_id = ? OR partner_email = ?) AND status = 'pending'").get(id, user.id, user.email);
      if (!approval) throw requestError("This request is no longer pending or you do not have permission to review it.", 404);

      if (decision === "approved") {
        if (approval.goal_id) {
          const goal = db.prepare("SELECT * FROM goals WHERE id = ?").get(approval.goal_id);
          if (goal && goal.current_cents >= approval.amount_cents) {
            db.prepare("UPDATE goals SET current_cents = current_cents - ? WHERE id = ?").run(approval.amount_cents, approval.goal_id);
          }
          db.prepare("UPDATE users SET savings_cents = MAX(0, savings_cents - ?), everyday_cents = everyday_cents + ? WHERE id = ?").run(approval.amount_cents, approval.amount_cents, approval.child_id);
          db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'release', ?, ?)").run(
            approval.child_id,
            approval.amount_cents,
            `Partner/Parent-approved early release: ${approval.reason}`
          );
        } else {
          // General wallet release
          db.prepare("UPDATE users SET savings_cents = MAX(0, savings_cents - ?), everyday_cents = everyday_cents + ? WHERE id = ?").run(approval.amount_cents, approval.amount_cents, approval.child_id);
          db.prepare("INSERT INTO transactions (user_id, type, amount_cents, note) VALUES (?, 'release', ?, ?)").run(
            approval.child_id,
            approval.amount_cents,
            `Approved release: ${approval.reason}`
          );
        }
      }

      db.prepare("UPDATE approvals SET status = ?, reviewed_by = ? WHERE id = ?").run(decision, user.id, id);
      db.exec("COMMIT");
      return send(res, 200, { message: decision === "approved" ? "Request approved and funds released." : "Request rejected." });
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  return bad(res, "API endpoint not found.", 404);
}

const pages = {
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
  "/allownance.html": "allownance.html",
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
};

const mimes = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon"
};

function page(file) {
  const filePath = path.join(PUBLIC_ROOT, file);
  if (!fs.existsSync(filePath)) return `<!DOCTYPE html><html><body>Page not found</body></html>`;
  return fs.readFileSync(filePath, "utf8").replace("</body>", '<script src="/client.js" defer></script></body>');
}

function serveResolvedFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") {
    send(res, 200, page(path.basename(file)), mimes[".html"]);
  } else {
    send(res, 200, fs.readFileSync(file), mimes[ext] || "application/octet-stream");
  }
  return true;
}

function staticFile(res, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const file = path.resolve(PUBLIC_ROOT, `.${decodedPath}`);
  if (!file.startsWith(PUBLIC_ROOT)) return false;

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return serveResolvedFile(res, file);
  }

  try {
    const targetBase = path.basename(file).toLowerCase();
    const allFiles = fs.readdirSync(PUBLIC_ROOT);
    const matched = allFiles.find(f => f.toLowerCase() === targetBase);
    if (matched) {
      const matchedPath = path.join(PUBLIC_ROOT, matched);
      if (fs.statSync(matchedPath).isFile()) {
        return serveResolvedFile(res, matchedPath);
      }
    }
  } catch {}

  return false;
}

const server = http.createServer(async (req, res) => {
  const hostHeader = req.headers.host || "localhost";
  const url = new URL(req.url, `http://${hostHeader}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/health" || pathname === "/api/health") {
      return send(res, 200, {
        status: "ok",
        app: "FinanceBuddy",
        version: "2.0-goal-first",
        disclaimer: DISCLAIMER,
        timestamp: new Date().toISOString()
      });
    }
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    if (pathname === "/client.js") return send(res, 200, fs.readFileSync(path.join(ROOT, "client.js"), "utf8"), mimes[".js"]);
    if (pathname === "/emergency" || pathname === "/emergency.html") {
      const user = currentUser(req);
      const targetPage = user?.role === "child" ? "emergencyC.html" : "emergencyP.html";
      return send(res, 200, page(targetPage), mimes[".html"]);
    }
    if (pages[pathname]) return send(res, 200, page(pages[pathname]), mimes[".html"]);
    if (staticFile(res, pathname)) return;
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    if (!error.expose) console.error(error);
    return bad(res, error.expose ? error.message : "Unexpected server error.", error.status || 500);
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`FinanceBuddy is running at http://${HOST}:${PORT} (environment: ${production ? "production" : "development"})`);
  });
}

const shutdown = () => {
  console.log("Shutting down FinanceBuddy gracefully...");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { server, db, migrateSchema, seedDemoAccounts };
