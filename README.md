# 💜 FinanceBuddy — Goal-First Wealth & Budgeting For Every Stage of Life

> **⚠️ Disclaimer:** FinanceBuddy is a goal-planning and learning tool. All balances are simulated; no real money is held or moved.

---

## 🎯 About FinanceBuddy

FinanceBuddy is a **Goal-First** financial planning platform designed to make saving money intuitive, disciplined, and rewarding. While built especially for **children and teens** setting their very first financial goals, it scales seamlessly for **students, young adults, working professionals, and families** who want to build emergency resilience and achieve major life milestones.

Instead of passive tracking, FinanceBuddy enforces intentional money management:
- **Goals are the center** — Create unlimited goals (education, gadgets, travel, emergency buffer, wedding, home, business) with automated weekly/monthly savings targets and progress tracking.
- **Self-discipline lock** — Funds in goals are locked until completion. Early withdrawals require a reason, initiate a **24-hour cooling-off period**, and calculate how many days your milestone gets delayed.
- **Accountability partners & Parent safeguards** — Individual adults can assign a trusted partner to review early withdrawals, while children remain safely under parental guidance.
- **Round-up micro-savings** — Simulated card purchases automatically round up to spare change, quietly accelerating goal achievements.
- **Age-aware allocation plans** — Tailored default splits for children, teens, young adults, and adults, with customizable percentages.
- **Emergency fund guidance** — Target 3 to 6 months of essential living expenses, showing active months covered.
- **Multi-level Learning Hub** — Tagged bite-sized modules for Kids, Teens, and Adults covering 50/30/20 budgeting, emergency runway, SIP compounding, debt elimination, and digital scam defense.

---

## 👥 3 Account Modes

At registration, users choose how they will use FinanceBuddy:

| Mode | Target User | Role | Description |
|---|---|---|---|
| **👨‍👩‍👧 Family** | Parents & Children | `PARENT` or `CHILD` | A parent creates and funds child wallets with strict parental withdrawal approvals. Children under 18 must be linked to a guardian. |
| **👤 Myself** | Working Adults (18+) | `INDIVIDUAL` | Fully self-managed goals, custom split percentages, 3-6 month emergency fund runway, and 24-hour cooling-off self-discipline lock. |
| **🎓 Teen / Student** | Teens & Students (13–17+) | `INDIVIDUAL` | Self-managed student account with an optional **Accountability Partner** invited by email to keep impulse spending in check. |

---

## ✨ Core Features

### 1. Goal-First Architecture
- **Unlimited Goals**: Assign category (`education`, `gadget`, `travel`, `emergency`, `business`, `health`, `wedding`, `home`, `other`), target amount, deadline, priority, and emoji icon.
- **Automated Target Pacing**: Computes exact required savings **per week** and **per month** to reach deadlines on time.
- **Pacing Status**: Real-time `On Track`, `Behind Target`, or `Ahead` metrics with projected completion dates.
- **Milestone Celebrations**: Distinct celebration badges at **25% (Seed Saver 🥉)**, **50% (Halfway Hero 🥈)**, **75% (Summit Seeker 🥇)**, and **100% (Goal Achieved 🏆)**.
- **Completion Payout**: Once 100% is reached, withdraw immediately to everyday spending or launch a new goal.

### 2. Self-Discipline Lock & Safeguards
- **Goal Lock**: Saved assets are protected from impulse raiding.
- **24-Hour Cooling-Off Period**: For individual savers, early withdrawals enter a 24-hour reflection countdown with calculated milestone delay days.
- **Accountability Partner Flow**: Add a trusted friend, mentor, or guardian email who must approve early withdrawals before funds unlock.
- **Parental Safeguards**: Family child accounts require parent approval for all savings drawdowns.

### 3. Micro-Savings & Age Presets
- **Round-Up Savings**: Simulated spending (e.g. ₹82) rounds up to ₹90, instantly depositing ₹8 of spare change into your active goal.
- **Age-Based Allocation Presets**:
  - **Child (6–12)**: 50% Everyday / 20% Emergency / 30% Savings
  - **Teen (13–17)**: 50% Everyday / 30% Emergency / 20% Savings
  - **Young Adult (18–25)**: 50% Everyday / 20% Emergency / 30% Savings
  - **Adult (26+)**: 50% Everyday / 30% Emergency / 20% Savings
- **Emergency Guidance**: Computes 3-month and 6-month targets based on monthly expenses, displaying live months-covered status.

### 4. Financial Learning Hub
- **Level Filters**: Toggle between `Kids (6-12)`, `Teens (13-17)`, and `Adults (18+)` (defaults to user's age level).
- **Adult Modules**:
  - Modern Budgeting (50/30/20 & Zero-Based)
  - Emergency Funds (3–6 Months Liquid Runway)
  - SIP Basics & Systematic Compounding
  - Debt Basics (Good vs Bad Debt, Snowball & Avalanche)
  - Financial Scams (Phishing, Fake QR Codes & Ponzi schemes)
- **Streaks & Daily Challenges**: Keep a daily streak active with scenario-based decision challenges.

### 5. Multi-Currency Support
- Switch between **₹ INR (Indian Rupee)** and **$ USD (US Dollar)** at any time with a single click.
- All amounts formatted via native `Intl.NumberFormat`.

---

## 🔑 Seed Demo Accounts

FinanceBuddy comes pre-seeded with 4 demo accounts representing each mode:

| Account | Email | Password | Role / Mode | Age | Starting Profile |
|---|---|---|---|---|---|
| **Sarah Jenkins** | `sarah@example.com` | `password123` | `PARENT` (Family) | 38 | Parent managing family wallet & child approvals |
| **Leo Jenkins** | `leo@example.com` | `password123` | `CHILD` (Family) | 14 | Active goal: "Smart Coding Laptop" (80% achieved) |
| **Riya Sharma** | `riya@example.com` | `password123` | `INDIVIDUAL` (Myself) | 28 | Goals: "Trip to Japan" (75%) & "6-Month Emergency Fund" (100%) |
| **Aman Verma** | `aman@example.com` | `password123` | `INDIVIDUAL` (Teen) | 17 | Student goal: "Study Laptop" (50%) with partner `mentor@example.com` |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22.5+ (uses built-in `node:sqlite`) |
| **Server** | Zero-dependency native `node:http` |
| **Database** | SQLite (WAL mode, foreign keys, automated migrations) |
| **Auth** | HMAC-SHA256 signed session tokens + `crypto.scrypt` password hashing |
| **Frontend** | Responsive Vanilla HTML5/CSS3 + `client.js` integration layer |
| **AI Layer** | Age-aware AI Coach (Groq llama-3.1-8b-instant with rule-based heuristic fallbacks) |
| **Testing** | Node.js built-in `node:test` and `node:assert/strict` |

---

## 🚀 Running Locally

**Prerequisites:** Node.js **22.5.0** or higher.

```bash
# Clone the repository
git clone https://github.com/dhruvpatel09cg/Finance-Buddy.git
cd Finance-Buddy

# Start the application
node server.js
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

To run with auto-restart on file changes:
```bash
node --watch server.js
```

### Running Automated Tests
```bash
node --test tests/e2e.test.js
```
The test suite validates:
- Seed demo account authentication
- Family mode wallet funding, allocation splits, and child approval reviews
- Myself mode age restriction (< 18), unlimited goals, manual deposits, round-up savings, self-discipline 24h cooling-off locks, and completed goal payouts
- Teen mode with accountability partner approval flow
- Dual currency toggling (INR / USD)
- Learning Hub levels and streak updates
- Age-adapted AI coach tones and insights
- Universal simulated money disclaimer verification

---

## 🌐 Deploying to Render

This repository includes a production-ready `render.yaml` blueprint with persistent disk storage for SQLite:

1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Blueprint** and select `render.yaml`.
3. Set optional environment variable `GROQ_API_KEY` in Render settings for live LLM explanations.
4. Deploy! Render will mount persistent storage at `/var/data` so your SQLite database survives service restarts.

---

## 🔌 REST API Reference

| Method | Path | Role / Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register with mode (`family`, `myself`, `teen`), age, role, currency |
| `POST` | `/api/auth/login` | Public | Login with email & password; returns HMAC session token |
| `GET` | `/api/me` | Authenticated | Get current authenticated user profile, mode, and currency |
| `GET` | `/api/dashboard` | Authenticated | Balances, emergency guidance, goals, approvals, and cooling-off alerts |
| `GET` | `/api/goals` | Authenticated | List user's goals with required weekly/monthly pacing & milestones |
| `POST` | `/api/goals` | Authenticated | Create an unlimited goal (name, category, target, deadline, priority, icon) |
| `POST` | `/api/goals/:id/deposit` | Authenticated | Deposit money from Everyday wallet into goal |
| `POST` | `/api/goals/:id/simulate-spend` | Authenticated | Simulate card purchase with automatic round-up micro savings |
| `POST` | `/api/goals/:id/withdraw` | Authenticated | Withdraw (immediate if 100% completed; initiates cooling-off/partner approval if early) |
| `POST` | `/api/approvals/:id/finalize-cooling-off` | Authenticated | Finalize early withdrawal after 24h cooling-off expires |
| `POST` | `/api/plan-split` | Authenticated | Customize split percentages (Everyday + Emergency + Savings = 100) |
| `POST` | `/api/currency` | Authenticated | Toggle currency between `INR` and `USD` |
| `GET` | `/api/learning` | Authenticated | Get literacy modules tagged by level (`Kids`, `Teens`, `Adults`) and streak |
| `POST` | `/api/learning/complete` | Authenticated | Complete a module or challenge and increment streak |
| `GET` | `/api/ai-insights` | Authenticated | Age-tailored goal insights and emergency runway assessment |
| `POST` | `/api/ai-suggestion` | Public/Auth | AI coach allocation explanation (Groq + heuristic fallback) |
| `POST` | `/api/funds` | Parent / Indiv | Fund wallet with automatic age-preset split |
| `GET` | `/api/transactions` | Authenticated | Ledger history of deposits, spend, releases, and round-ups |
| `POST` | `/api/approvals/:id/review` | Parent / Partner | Approve or reject an early release request |
| `GET` | `/api/health` | Public | Service health and disclaimer |

---

## 👥 Team

- **Dhruv Patel** — [GitHub](https://github.com/dhruvpatel09cg)
- **Aditya Katariya**
- **Om Vaniya**
- **Kashyap Katariya**

## 📄 License

Open source, available under the [MIT License](LICENSE).

<p align="center">Made with 💜 to empower people of all ages to achieve their financial goals.</p>
