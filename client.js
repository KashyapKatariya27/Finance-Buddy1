(() => {
  "use strict";
  const tokenKey = "financeBuddyToken";
  const currencyKey = "financeBuddyCurrency";
  const DISCLAIMER_TEXT = "FinanceBuddy is a goal-planning and learning tool. All balances are simulated; no real money is held or moved.";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const getCurrency = () => localStorage.getItem(currencyKey) || "INR";

  const formatMoney = (cents, currency = getCurrency()) => {
    const locale = currency === "USD" ? "en-US" : "en-IN";
    const amount = (Number(cents) || 0) / 100;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const show = (message) => window.alert(message);

  const request = async (url, options = {}) => {
    const token = localStorage.getItem(tokenKey);
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  };

  const gotoAccount = (role, redirectTo) => {
    if (redirectTo) return window.location.assign(redirectTo);
    if (role === "child") return window.location.assign("/kids");
    return window.location.assign("/dashboard");
  };

  const goHome = () => window.location.assign("/");
  const signOut = () => {
    localStorage.removeItem(tokenKey);
    goHome();
  };

  const saveEvent = (action, details = "") =>
    request("/api/events", { method: "POST", body: JSON.stringify({ action, details }) }).catch(() => {});

  const makeInteractive = (element, action, label) => {
    if (!element) return;
    element.setAttribute("role", "link");
    element.setAttribute("tabindex", "0");
    if (label) element.setAttribute("aria-label", label);
    element.style.cursor = "pointer";
    element.addEventListener("click", action);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action(event);
      }
    });
  };

  // Inject Disclaimer Footer across all views
  const injectDisclaimerFooter = () => {
    if ($(".fb-disclaimer-footer")) return;
    const footer = document.createElement("footer");
    footer.className = "fb-disclaimer-footer";
    footer.style.cssText =
      "width:100%; text-align:center; padding:18px 24px; font-size:12px; color:#9fa4d4; background:rgba(15,10,45,0.75); border-top:1px solid rgba(124,92,255,0.25); margin-top:40px; line-height:1.5;";
    footer.innerHTML = `⚠️ <strong>Disclaimer:</strong> ${DISCLAIMER_TEXT}`;
    document.body.appendChild(footer);
  };

  // Inject Currency Switcher into top nav if user is logged in
  const injectCurrencySwitcher = (currentUser) => {
    if ($("#fbCurrencyToggle")) return;
    const currentCur = currentUser?.currency || getCurrency();
    const nav = $(".header__actions") || $(".nav-right") || $("header .flex.items-center.gap-3:last-child") || $(".user");
    if (!nav) return;

    const switcher = document.createElement("div");
    switcher.id = "fbCurrencyToggle";
    switcher.style.cssText = "display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.12); padding:4px 8px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; margin-right:12px; border:1px solid rgba(255,255,255,0.25);";
    switcher.innerHTML = `
      <span style="color:${currentCur === "INR" ? "#3fd67c" : "#ffffff"}">₹ INR</span>
      <span style="opacity:0.4;">|</span>
      <span style="color:${currentCur === "USD" ? "#3fd67c" : "#ffffff"}">$ USD</span>
    `;

    switcher.addEventListener("click", async () => {
      const newCur = currentCur === "INR" ? "USD" : "INR";
      localStorage.setItem(currencyKey, newCur);
      try {
        await request("/api/currency", { method: "POST", body: JSON.stringify({ currency: newCur }) });
      } catch {}
      window.location.reload();
    });

    nav.prepend(switcher);
  };

  // Universal Navigation Routing
  const pageRoutes = {
    "Overview": "/dashboard",
    "Goals": "/goals",
    "Savings Goals": "/goals",
    "Saving Goals": "/goals",
    "Chores & Allowance": "/allowance",
    "Chores &amp; Allowance": "/allowance",
    "Emergency Vault": "/emergency",
    "Learning Hub": "/learning",
    "AI Assistant": "/learning",
    "Transactions": "/transactions",
    "Family Activity": "/activity",
    "My Child": "/my-child",
    "Wallet": "/kids"
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".nav-links a, nav a, .nav a, .nav__link") : null;
    if (!target) return;
    const label = target.textContent.trim().replace(/&amp;/g, "&");
    const destination = pageRoutes[label];
    if (destination) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(destination);
    }
  }, true);

  // ==========================================
  // LOGIN PAGE
  // ==========================================
  const login = $("#loginForm");
  if (login) {
    makeInteractive($(".logo"), goHome, "Return to FinanceBuddy home");
    document.addEventListener("submit", async (event) => {
      if (event.target !== login) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try {
        const data = await request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: $("#email").value,
            password: $("#password").value
          })
        });
        localStorage.setItem(tokenKey, data.token);
        if (data.user?.currency) localStorage.setItem(currencyKey, data.user.currency);
        gotoAccount(data.user.role, data.redirectTo);
      } catch (error) {
        show(error.message);
      }
    }, true);
    $(".signup a")?.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.assign("/register");
    });
  }

  // ==========================================
  // REGISTER PAGE (3 MODES: Family, Myself, Teen)
  // ==========================================
  const register = $("#registerForm");
  if (register) {
    makeInteractive($(".logo"), goHome, "Return to FinanceBuddy home");
    document.addEventListener("submit", async (event) => {
      if (event.target !== register) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const pw = $("#password").value;
      const confirmPw = $("#confirmPassword").value;
      if (pw !== confirmPw) return show("Passwords do not match.");

      const selectedModeBtn = document.querySelector(".mode-btn.active");
      const accountMode = selectedModeBtn ? selectedModeBtn.dataset.mode : "family";
      const age = Number($("#ageInput")?.value || 25);
      const currency = $("#currencySelect")?.value || "INR";

      let role = "individual";
      if (accountMode === "family") {
        const isChild = $("#tabChild")?.classList.contains("active");
        role = isChild ? "child" : "parent";
      }

      if (accountMode === "myself" && age < 18) {
        return show("Children under 18 must always stay under a guardian. Please register under Family or Teen mode.");
      }

      try {
        const data = await request("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            fullName: $("#fullName").value,
            email: $("#email").value,
            password: pw,
            accountMode,
            role,
            age,
            currency,
            parentEmail: $("#parentEmail")?.value || "",
            accountabilityPartnerEmail: $("#partnerEmail")?.value || ""
          })
        });
        localStorage.setItem(tokenKey, data.token);
        localStorage.setItem(currencyKey, data.user?.currency || currency);
        gotoAccount(data.user.role, data.redirectTo);
      } catch (error) {
        show(error.message);
      }
    }, true);
  }

  // ==========================================
  // LANDING PAGE INTERACTIVITY
  // ==========================================
  if (["/", "/lending", "/lending.html", "/index.html", "/index"].includes(location.pathname)) {
    $$("a").forEach(link => {
      const label = link.textContent.trim();
      if (label === "Sign In") link.addEventListener("click", (e) => { e.preventDefault(); window.location.assign("/login"); });
      if (label === "Get Started Free") link.addEventListener("click", (e) => { e.preventDefault(); window.location.assign("/register"); });
    });
  }

  // ==========================================
  // AUTHENTICATED PAGES DATA POPULATION
  // ==========================================
  const privatePages = [
    "/dashboard", "/dashboard.html",
    "/kids", "/kids.html", "/wallet", "/wallet.html",
    "/child", "/child.html",
    "/my-child", "/my-child.html",
    "/transactions", "/Transaction.html", "/transactions.html",
    "/allowance", "/allownance.html",
    "/goals", "/goals.html", "/savinggoals1.html", "/savinggoals.html",
    "/activity",
    "/learning", "/learning.html",
    "/emergency", "/emergency.html", "/emergencyC.html", "/emergencyP.html",
    "/withdrawal", "/withdrawal.html"
  ];

  if (privatePages.includes(location.pathname)) {
    request("/api/me").then(({ user }) => {
      if (user.currency) localStorage.setItem(currencyKey, user.currency);
      injectCurrencySwitcher(user);
      injectDisclaimerFooter();

      // Replace user names and roles across all pages
      $$(".user-name, .user strong, .profile .name, .child__name").forEach(el => {
        el.textContent = user.fullName;
      });

      $$(".user-role, .user span, .profile .role").forEach(el => {
        if (user.role === "parent") el.textContent = "Guardian Account";
        else if (user.role === "child") el.textContent = "Child Account";
        else if (user.accountMode === "teen") el.textContent = "Student Account";
        else el.textContent = "Individual Account";
      });

      // Hide chores and allowance for Individual / Teen accounts
      if (user.role === "individual" || user.accountMode === "myself" || user.accountMode === "teen") {
        $$("a, .nav__link").forEach(link => {
          const txt = link.textContent.trim().toLowerCase();
          if (txt.includes("chore") || txt.includes("allowance") || txt.includes("my child")) {
            link.style.display = "none";
          }
        });
      }

      makeInteractive($(".logo, .brand, .nav-left"), goHome, "Return to FinanceBuddy home");
      makeInteractive($(".user, .profile, .nav-right"), signOut, "Sign out");
    }).catch(() => {
      localStorage.removeItem(tokenKey);
      window.location.replace("/login");
    });
  }

  // ==========================================
  // DASHBOARD PAGE
  // ==========================================
  if (["/dashboard", "/dashboard.html"].includes(location.pathname)) {
    request("/api/dashboard").then((data) => {
      const { user, balances, emergencyGuidance, planSplit, goals, pendingApproval, coolingOffRequests } = data;
      const currency = user.currency || getCurrency();

      if (user.role === "child") return window.location.replace("/kids");

      // Update Header Text by Role / Mode
      const headTitle = $(".page-head h1");
      const headSub = $(".page-head p");
      if (headTitle) {
        if (user.role === "parent") headTitle.textContent = `${user.fullName}'s Family Dashboard`;
        else if (user.accountMode === "teen") headTitle.textContent = `${user.fullName}'s Student Goal Dashboard`;
        else headTitle.textContent = `${user.fullName}'s Wealth & Goal Dashboard`;
      }
      if (headSub) {
        if (user.role === "parent") headSub.textContent = `Guiding linked family accounts`;
        else if (user.accountMode === "teen") headSub.textContent = `Age ${user.age} • Self-managed student plan with milestone goals`;
        else headSub.textContent = `Age ${user.age} • Personal wealth, emergency buffer, and milestone goals`;
      }

      // Hide Parent specific buttons if Individual/Teen
      if (user.role === "individual") {
        const fundBtn = $(".btn-fund");
        if (fundBtn) fundBtn.innerHTML = `+ Add Funds`;
      }

      // Balance values
      const balTotal = $(".child__balance-value, .balance-block .amount");
      if (balTotal) balTotal.textContent = formatMoney(balances.total, currency);

      // Allocation split bar & title
      const allocTitle = $(".allocation__head h3");
      if (allocTitle) allocTitle.textContent = `Active Plan (${planSplit.preset.name}): ${planSplit.everyday}% Everyday / ${planSplit.emergency}% Emergency / ${planSplit.savings}% Savings`;

      const segs = $$(".allocation__bar .seg");
      if (segs[0]) segs[0].style.width = `${planSplit.everyday}%`;
      if (segs[1]) segs[1].style.width = `${planSplit.emergency}%`;
      if (segs[2]) segs[2].style.width = `${planSplit.savings}%`;

      // Breakdown tags
      const splitTags = $$(".allocation__legend span, .allocation-labels span");
      if (splitTags.length >= 3) {
        splitTags[0].textContent = `Everyday: ${formatMoney(balances.everyday, currency)} (${planSplit.everyday}%)`;
        splitTags[1].textContent = `Emergency Vault: ${formatMoney(balances.emergency, currency)} (${planSplit.emergency}%)`;
        splitTags[2].textContent = `Goal Savings: ${formatMoney(balances.savings, currency)} (${planSplit.savings}%)`;
      }

      // Emergency Guidance Widget injection
      let emergencyWidget = $("#emergencyGuidanceCard");
      if (!emergencyWidget) {
        emergencyWidget = document.createElement("article");
        emergencyWidget.id = "emergencyGuidanceCard";
        emergencyWidget.className = "card";
        emergencyWidget.style.cssText = "margin-top:20px; padding:20px; background:rgba(255,255,255,0.06); border:1px solid rgba(124,92,255,0.3); border-radius:16px;";
        const mainCol = $(".dashboard__main") || $(".dashboard");
        if (mainCol) mainCol.appendChild(emergencyWidget);
      }
      if (emergencyWidget) {
        emergencyWidget.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:16px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px;">
              🛡️ Emergency Fund Guidance
            </h3>
            <span style="font-size:12px; font-weight:700; padding:4px 10px; border-radius:999px; background:rgba(31,157,85,0.25); color:#3fd67c; border:1px solid rgba(31,157,85,0.4);">
              ${emergencyGuidance.status}
            </span>
          </div>
          <p style="font-size:13px; color:#b8b0e0; margin:0 0 14px; line-height:1.5;">
            Financial safety baseline targets <strong>3 to 6 months</strong> of living expenses.
            Your current emergency reserve of <strong>${formatMoney(balances.emergency, currency)}</strong> provides
            <strong style="color:#ffffff;">${emergencyGuidance.monthsCovered} months</strong> of runway (based on ${formatMoney(emergencyGuidance.monthlyExpenses, currency)}/mo estimated expenses).
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px;">
            <div style="background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:10px;">
              <span style="color:#a5a1cc; display:block;">3-Month Target</span>
              <strong style="font-size:14px; color:#ffffff;">${formatMoney(emergencyGuidance.target3Months, currency)}</strong>
            </div>
            <div style="background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:10px;">
              <span style="color:#a5a1cc; display:block;">6-Month Target (Full Buffer)</span>
              <strong style="font-size:14px; color:#ffffff;">${formatMoney(emergencyGuidance.target6Months, currency)}</strong>
            </div>
          </div>
        `;
      }

      // Active Goals Section Injection
      let goalsSection = $("#dashboardGoalsSection");
      if (!goalsSection) {
        goalsSection = document.createElement("article");
        goalsSection.id = "dashboardGoalsSection";
        goalsSection.className = "card";
        goalsSection.style.cssText = "margin-top:20px; padding:20px; background:rgba(255,255,255,0.06); border:1px solid rgba(124,92,255,0.3); border-radius:16px;";
        const mainCol = $(".dashboard__main") || $(".dashboard");
        if (mainCol) mainCol.appendChild(goalsSection);
      }
      if (goalsSection) {
        goalsSection.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:16px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px;">
              🎯 Active Savings Goals (${goals.length})
            </h3>
            <a href="/goals" style="font-size:12px; font-weight:600; color:#8fe3a8; text-decoration:none;">Manage All Goals &rarr;</a>
          </div>
          <div id="dashboardGoalsList" style="display:flex; flex-direction:column; gap:12px;">
            ${goals.length === 0 ? '<p style="color:#b8b0e0; font-size:13px;">No active goals yet. Click below to launch your first goal!</p>' : ''}
          </div>
          <button id="btnQuickCreateGoal" style="margin-top:14px; width:100%; padding:10px 0; background:rgba(124,92,255,0.25); border:1px dashed #7c5cff; border-radius:10px; color:#ffffff; font-weight:600; font-size:13px; cursor:pointer;">
            + Create New Goal
          </button>
        `;

        const listContainer = $("#dashboardGoalsList");
        goals.slice(0, 3).forEach(g => {
          const item = document.createElement("div");
          item.style.cssText = "background:rgba(0,0,0,0.25); padding:14px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);";
          item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:20px;">${g.icon || "🎯"}</span>
                <div>
                  <strong style="font-size:14px;">${g.name}</strong>
                  <div style="font-size:11px; color:#b8b0e0;">Due: ${g.deadline} · Need: ${formatMoney(g.requiredPerWeekCents, currency)}/wk</div>
                </div>
              </div>
              <div style="text-align:right;">
                <span style="font-size:13px; font-weight:700; color:#3fd67c;">${formatMoney(g.currentCents, currency)}</span>
                <span style="font-size:11px; color:#8b86b5;"> / ${formatMoney(g.targetCents, currency)}</span>
              </div>
            </div>
            <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:999px; overflow:hidden; margin:8px 0 4px;">
              <div style="width:${g.progressPercentage}%; height:100%; background:linear-gradient(90deg, #3fd67c, #4f6bff); border-radius:999px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#b8b0e0;">
              <span>${g.progressPercentage}% Completed</span>
              <span style="color:${g.onTrackStatus === 'behind' ? '#ff7b7b' : '#8fe3a8'}; font-weight:600;">
                ${g.isCompleted ? '🏆 Achieved!' : (g.onTrackStatus === 'behind' ? '⚠️ Behind Schedule' : '⚡ On Track')}
              </span>
            </div>
          `;
          listContainer.appendChild(item);
        });

        $("#btnQuickCreateGoal")?.addEventListener("click", () => window.location.assign("/goals"));
      }

      // Cooling-off early withdrawal alert banner
      if (coolingOffRequests && coolingOffRequests.length > 0) {
        const alertBox = document.createElement("div");
        alertBox.style.cssText = "background:rgba(245,158,11,0.15); border:1px solid #f59e0b; padding:14px; border-radius:12px; margin-bottom:20px; font-size:13px;";
        const req = coolingOffRequests[0];
        const remainingHours = Math.max(0, Math.ceil((new Date(req.unlockAt).getTime() - Date.now()) / (1000 * 60 * 60)));
        alertBox.innerHTML = `
          <strong>⏳ Self-Discipline Lock Active:</strong>
          Early withdrawal request for <strong>${formatMoney(req.amount, currency)}</strong> (${req.reason}) is cooling off.
          ${req.isUnlocked ? '<span style="color:#3fd67c; font-weight:700;">Cooling-off complete! Ready to finalize.</span>' : `Unlocks in <strong>${remainingHours} hours</strong> (Delays goal by ${req.delayDays} days).`}
          <a href="/goals" style="color:#fbbf24; margin-left:10px; font-weight:700;">View in Goals &rarr;</a>
        `;
        const container = $(".container") || document.body;
        container.prepend(alertBox);
      }

      // Fund Wallet Button
      $(".btn-fund")?.addEventListener("click", async () => {
        const amount = window.prompt(`Amount to add to wallet (${currency}):`);
        if (!amount) return;
        try {
          const res = await request("/api/funds", {
            method: "POST",
            body: JSON.stringify({ amount, note: "Manual Wallet Deposit" })
          });
          show(res.message);
          location.reload();
        } catch (err) {
          show(err.message);
        }
      });

      // Modify Plan Link
      $(".link-indigo, .allocation__head a")?.addEventListener("click", async (e) => {
        e.preventDefault();
        const ev = window.prompt("Everyday Spending % (default 50):", String(planSplit.everyday));
        if (ev === null) return;
        const em = window.prompt("Emergency Vault % (default 20):", String(planSplit.emergency));
        if (em === null) return;
        const sv = window.prompt("Savings Goals % (default 30):", String(planSplit.savings));
        if (sv === null) return;

        try {
          const res = await request("/api/plan-split", {
            method: "POST",
            body: JSON.stringify({ everyday: Number(ev), emergency: Number(em), savings: Number(sv) })
          });
          show(res.message);
          location.reload();
        } catch (err) {
          show(err.message);
        }
      });

      // Review Pending Request (Parent or Partner)
      if (pendingApproval) {
        const sideCard = $(".side-card p, .card--approval p");
        if (sideCard) sideCard.textContent = `A withdrawal request for ${formatMoney(pendingApproval.amount, currency)} is awaiting your review: "${pendingApproval.reason}".`;
      }
    }).catch(err => {
      console.error(err);
      show(err.message);
    });
  }

  // ==========================================
  // GOALS PAGE (SAVINGGOALS1.HTML)
  // ==========================================
  if (["/goals", "/goals.html", "/savinggoals1.html", "/savinggoals.html"].includes(location.pathname)) {
    const goalsContainer = $(".goals-card, #goalsListContainer");
    let currentCurrency = getCurrency();

    const loadGoals = async () => {
      try {
        const { goals } = await request("/api/goals");
        const { user } = await request("/api/me");
        currentCurrency = user.currency || getCurrency();

        // Update Header
        const subText = $(".dashboard-header p");
        if (subText) subText.textContent = `Unlimited Goal Tracker · Track milestones, simulated round-up savings, and self-discipline locks.`;

        // Render goals
        let listWrapper = $("#fbGoalsDynamicList");
        if (!listWrapper) {
          listWrapper = document.createElement("div");
          listWrapper.id = "fbGoalsDynamicList";
          listWrapper.style.cssText = "display:flex; flex-direction:column; gap:16px; margin-top:16px;";
          const targetCard = $(".goals-card");
          if (targetCard) {
            // Remove hardcoded static sample goals
            $$(".goal-item").forEach(item => item.remove());
            targetCard.appendChild(listWrapper);
          }
        }

        listWrapper.innerHTML = "";
        if (goals.length === 0) {
          listWrapper.innerHTML = `<p style="padding:24px; text-align:center; color:#b8b0e0;">No goals created yet. Click "+ Create Custom Goal" above to start your journey!</p>`;
        }

        goals.forEach(goal => {
          const card = document.createElement("div");
          card.className = `goal-item goal-${goal.priority === 'high' ? 'blue' : 'green'}`;
          card.style.cssText = "background:rgba(255,255,255,0.06); border:1px solid rgba(124,92,255,0.3); border-radius:14px; padding:16px; margin-bottom:12px;";

          // Milestone badges HTML
          const m = goal.milestones;
          const badgesHtml = `
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
              <span style="font-size:10px; padding:2px 8px; border-radius:6px; background:${m.m25 ? 'rgba(31,157,85,0.3)' : 'rgba(255,255,255,0.08)'}; color:${m.m25 ? '#3fd67c' : '#777'};">🥉 25% Seed</span>
              <span style="font-size:10px; padding:2px 8px; border-radius:6px; background:${m.m50 ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}; color:${m.m50 ? '#60a5fa' : '#777'};">🥈 50% Halfway</span>
              <span style="font-size:10px; padding:2px 8px; border-radius:6px; background:${m.m75 ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)'}; color:${m.m75 ? '#c084fc' : '#777'};">🥇 75% Summit</span>
              <span style="font-size:10px; padding:2px 8px; border-radius:6px; background:${m.m100 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}; color:${m.m100 ? '#fbbf24' : '#777'}; font-weight:700;">🏆 100% Achieved</span>
            </div>
          `;

          card.innerHTML = `
            <div class="goal-top" style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div class="goal-left" style="display:flex; gap:12px; align-items:center;">
                <div class="goal-icon" style="font-size:26px;">${goal.icon || '🎯'}</div>
                <div>
                  <p class="goal-title" style="font-size:16px; font-weight:700; margin:0;">${goal.name} <span style="font-size:11px; text-transform:uppercase; opacity:0.7;">[${goal.category}]</span></p>
                  <p class="goal-sub" style="font-size:12px; color:#b8b0e0; margin:4px 0 0;">
                    Deadline: <strong>${goal.deadline}</strong> ·
                    Required: <strong>${formatMoney(goal.requiredPerWeekCents, currentCurrency)}/wk</strong> (${formatMoney(goal.requiredPerMonthCents, currentCurrency)}/mo)
                  </p>
                  <p style="font-size:11px; margin:2px 0 0; color:${goal.onTrackStatus === 'behind' ? '#ff7b7b' : '#8fe3a8'};">
                    Status: <strong>${goal.isCompleted ? 'Goal Achieved 🎉' : (goal.onTrackStatus === 'behind' ? '⚠️ Behind Target' : '⚡ On Track')}</strong>
                    ${goal.daysAheadOrBehind > 0 ? `· Finish ~${Math.round(goal.daysAheadOrBehind/7)} weeks early` : ''}
                  </p>
                </div>
              </div>
              <div style="text-align:right;">
                <span class="goal-amount" style="font-size:15px; font-weight:700; color:#ffffff;">
                  ${formatMoney(goal.currentCents, currentCurrency)} / ${formatMoney(goal.targetCents, currentCurrency)}
                </span>
                <div style="font-size:12px; color:#3fd67c; font-weight:700;">(${goal.progressPercentage}%)</div>
              </div>
            </div>

            <div class="progress-track" style="margin:12px 0 8px; width:100%; height:8px; background:rgba(0,0,0,0.3); border-radius:999px; overflow:hidden;">
              <div class="progress-fill" style="width:${goal.progressPercentage}%; height:100%; background:linear-gradient(90deg, #3fd67c, #4f6bff); border-radius:999px;"></div>
            </div>

            ${badgesHtml}

            <div class="goal-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); flex-wrap:wrap; gap:8px;">
              <span class="lock-note" style="font-size:11px; color:#b8b0e0;">
                ${goal.isCompleted ? '✅ Goal achieved! Full balance withdrawable.' : '🔒 Self-Discipline Lock Active: Early withdrawal delays goal & triggers 24h cooling-off.'}
              </span>
              <div style="display:flex; gap:8px;">
                <button class="btn-deposit-goal" data-id="${goal.id}" style="padding:6px 12px; background:#1f9d55; border:none; border-radius:6px; color:#fff; font-size:11px; font-weight:700; cursor:pointer;">
                  + Deposit
                </button>
                <button class="btn-roundup-goal" data-id="${goal.id}" style="padding:6px 12px; background:#4f6bff; border:none; border-radius:6px; color:#fff; font-size:11px; font-weight:700; cursor:pointer;">
                  🛒 Spend &amp; Round-Up
                </button>
                <button class="btn-withdraw-goal" data-id="${goal.id}" style="padding:6px 12px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); border-radius:6px; color:#fff; font-size:11px; font-weight:600; cursor:pointer;">
                  ${goal.isCompleted ? '🎉 Withdraw' : 'Early Withdraw'}
                </button>
              </div>
            </div>
          `;
          listWrapper.appendChild(card);
        });

        // Bind Deposit Buttons
        $$(".btn-deposit-goal").forEach(btn => {
          btn.addEventListener("click", async () => {
            const goalId = btn.dataset.id;
            const amount = window.prompt(`Amount to deposit into this goal (${currentCurrency}):`);
            if (!amount) return;
            try {
              const res = await request(`/api/goals/${goalId}/deposit`, {
                method: "POST",
                body: JSON.stringify({ amount })
              });
              show(res.message);
              loadGoals();
            } catch (err) {
              show(err.message);
            }
          });
        });

        // Bind Round-up simulated spending buttons
        $$(".btn-roundup-goal").forEach(btn => {
          btn.addEventListener("click", async () => {
            const goalId = btn.dataset.id;
            const spendAmount = window.prompt(`Simulate card spend amount (e.g. 82) to trigger round-up:`);
            if (!spendAmount) return;
            try {
              const res = await request(`/api/goals/${goalId}/simulate-spend`, {
                method: "POST",
                body: JSON.stringify({ spendAmount, note: "Coffee & Book simulated spend" })
              });
              show(res.message);
              loadGoals();
            } catch (err) {
              show(err.message);
            }
          });
        });

        // Bind Withdraw / Early Withdraw buttons
        $$(".btn-withdraw-goal").forEach(btn => {
          btn.addEventListener("click", async () => {
            const goalId = btn.dataset.id;
            const targetGoal = goals.find(g => String(g.id) === String(goalId));
            if (!targetGoal) return;

            if (targetGoal.isCompleted) {
              const confirmWithdraw = window.confirm(`🎉 Goal "${targetGoal.name}" is ACHIEVED!\nWithdraw ${formatMoney(targetGoal.currentCents, currentCurrency)} to your Everyday wallet?`);
              if (!confirmWithdraw) return;
              try {
                const res = await request(`/api/goals/${goalId}/withdraw`, {
                  method: "POST",
                  body: JSON.stringify({ amount: (targetGoal.currentCents / 100).toFixed(2), reason: "Goal Achieved Completion" })
                });
                show(res.message);
                loadGoals();
              } catch (err) {
                show(err.message);
              }
              return;
            }

            // Early Withdrawal with Self-Discipline Lock
            const amount = window.prompt(`Enter early withdrawal amount (${currentCurrency}):`, (targetGoal.currentCents / 100).toFixed(2));
            if (!amount) return;
            const reason = window.prompt("Reason for early withdrawal (e.g. urgent car repair):");
            if (!reason) return;

            try {
              const res = await request(`/api/goals/${goalId}/withdraw`, {
                method: "POST",
                body: JSON.stringify({ amount, reason })
              });

              if (res.coolingOff) {
                const proceed = window.confirm(`${res.message}\n\nWould you like to finalize withdrawal immediately (simulate demo cooling-off bypass)?`);
                if (proceed) {
                  const finalRes = await request(`/api/approvals/${res.approvalId}/finalize-cooling-off`, {
                    method: "POST",
                    body: JSON.stringify({ simulate_bypass: true })
                  });
                  show(finalRes.message);
                }
              } else {
                show(res.message);
              }
              loadGoals();
            } catch (err) {
              show(err.message);
            }
          });
        });

      } catch (err) {
        console.error(err);
      }
    };

    loadGoals();

    // + Create Custom Goal Handler
    const createBtn = $(".btn-outline, #btnCreateGoal");
    if (createBtn) {
      createBtn.addEventListener("click", async () => {
        const name = window.prompt("Goal Name (e.g. Trip to Tokyo, New Laptop):");
        if (!name) return;
        const category = window.prompt("Category (education, gadget, travel, emergency, business, health, wedding, home, other):", "gadget");
        if (!category) return;
        const targetAmount = window.prompt(`Target Amount (${currentCurrency}):`, "50000");
        if (!targetAmount) return;
        const deadline = window.prompt("Deadline (YYYY-MM-DD):", "2027-06-30");
        if (!deadline) return;
        const icon = window.prompt("Goal Emoji Icon:", "🎯");

        try {
          const res = await request("/api/goals", {
            method: "POST",
            body: JSON.stringify({
              name,
              category,
              targetAmount,
              deadline,
              icon: icon || "🎯",
              priority: "high",
              roundUpEnabled: true
            })
          });
          show(res.message);
          loadGoals();
        } catch (err) {
          show(err.message);
        }
      });
    }
  }

  // ==========================================
  // LEARNING HUB PAGE (TAGGED KIDS, TEENS, ADULTS)
  // ==========================================
  if (["/learning", "/learning.html"].includes(location.pathname)) {
    request("/api/learning").then(({ modules, defaultLevel, streakDays }) => {
      // Update streak
      const streakEl = $(".badge-streak");
      if (streakEl) streakEl.textContent = `Academy Streak: ${streakDays} Days 🔥`;

      // Level Toggle buttons
      let filterBar = $("#learningLevelFilter");
      if (!filterBar) {
        filterBar = document.createElement("div");
        filterBar.id = "learningLevelFilter";
        filterBar.style.cssText = "display:flex; gap:10px; margin:18px 0 24px; flex-wrap:wrap;";
        filterBar.innerHTML = `
          <button class="level-tab" data-level="All" style="padding:8px 16px; border-radius:20px; border:1px solid #7c5cff; background:transparent; color:#fff; font-weight:600; font-size:12px; cursor:pointer;">All Levels</button>
          <button class="level-tab" data-level="Kids" style="padding:8px 16px; border-radius:20px; border:1px solid #7c5cff; background:transparent; color:#fff; font-weight:600; font-size:12px; cursor:pointer;">Kids (6-12)</button>
          <button class="level-tab" data-level="Teens" style="padding:8px 16px; border-radius:20px; border:1px solid #7c5cff; background:transparent; color:#fff; font-weight:600; font-size:12px; cursor:pointer;">Teens (13-17)</button>
          <button class="level-tab" data-level="Adults" style="padding:8px 16px; border-radius:20px; border:1px solid #7c5cff; background:transparent; color:#fff; font-weight:600; font-size:12px; cursor:pointer;">Adults (18+)</button>
        `;
        const header = $(".dashboard-header");
        if (header) header.appendChild(filterBar);
      }

      let activeLevel = defaultLevel || "Adults";

      const renderModules = (filter) => {
        $$(".level-tab").forEach(tab => {
          const match = tab.dataset.level === filter;
          tab.style.background = match ? "#7c5cff" : "transparent";
          tab.style.boxShadow = match ? "0 4px 12px rgba(124,92,255,0.4)" : "none";
        });

        const list = $(".module-list");
        if (!list) return;
        list.innerHTML = "";

        const filtered = filter === "All" ? modules : modules.filter(m => m.level === filter);

        filtered.forEach(mod => {
          const li = document.createElement("li");
          li.className = "module-item";
          li.style.cursor = "pointer";
          li.innerHTML = `
            <div class="module-icon" style="background:${mod.isCompleted ? '#1f9d55' : 'rgba(255,255,255,0.1)'}; color:#fff; display:grid; place-items:center;">
              ${mod.isCompleted ? '✓' : (mod.icon || '📖')}
            </div>
            <div class="module-info">
              <p class="module-title">${mod.title} <span style="font-size:10px; opacity:0.6; padding:1px 5px; border-radius:4px; border:1px solid rgba(255,255,255,0.2);">${mod.level}</span></p>
              <p class="module-sub">${mod.description}</p>
            </div>
            <div class="module-right">
              <span class="tag tag-purple">${mod.tag}</span>
              <span class="module-status" style="color:${mod.isCompleted ? '#3fd67c' : '#b8b0e0'}; font-weight:600;">
                ${mod.isCompleted ? '100% Completed' : '+ ' + mod.points + ' Pts'}
              </span>
            </div>
          `;

          li.addEventListener("click", async () => {
            if (mod.isCompleted) return show(`You have already completed "${mod.title}"!`);
            try {
              const res = await request("/api/learning/complete", {
                method: "POST",
                body: JSON.stringify({ moduleId: mod.id })
              });
              show(`${res.message} Earned ${mod.points} financial literacy points!`);
              window.location.reload();
            } catch (err) {
              show(err.message);
            }
          });

          list.appendChild(li);
        });
      };

      $$(".level-tab").forEach(tab => {
        tab.addEventListener("click", () => {
          activeLevel = tab.dataset.level;
          renderModules(activeLevel);
        });
      });

      renderModules(activeLevel);
    }).catch(console.error);

    // Fast challenge button handler
    const challengeBtn = $(".btn-option-primary");
    if (challengeBtn) {
      challengeBtn.addEventListener("click", async () => {
        try {
          const res = await request("/api/learning/complete", {
            method: "POST",
            body: JSON.stringify({ moduleId: "fast-daily-challenge" })
          });
          challengeBtn.textContent = "Correct! +$2.50 reward recorded";
          challengeBtn.disabled = true;
          show("Great choice! Your challenge completion has increased your streak!");
        } catch (err) {
          show(err.message);
        }
      });
    }
  }

  // ==========================================
  // TRANSACTIONS PAGE
  // ==========================================
  if (["/transactions", "/Transaction.html", "/transactions.html"].includes(location.pathname)) {
    request("/api/transactions").then(({ transactions, currency }) => {
      const cur = currency || getCurrency();
      const ledger = $("#transactionLedger");
      const empty = $("#noTransactions");
      if (!ledger) return;
      ledger.replaceChildren();
      if (!transactions || !transactions.length) {
        if (empty) empty.hidden = false;
        return;
      }
      if (empty) empty.hidden = true;

      transactions.forEach(tx => {
        const item = document.createElement("li");
        item.className = "entry";
        item.innerHTML = `
          <div class="entry__body">
            <strong>${tx.note}</strong>
            <span>${tx.accountName} · ${new Date(tx.createdAt + (tx.createdAt.endsWith("Z") ? "" : "Z")).toLocaleString()}</span>
          </div>
          <strong class="entry__amount" style="color:${tx.type.includes('spend') ? '#ff7b7b' : '#3fd67c'}">
            ${tx.type.includes('spend') ? '-' : '+'}${formatMoney(tx.amount, cur)}
          </strong>
        `;
        ledger.appendChild(item);
      });
    }).catch(console.error);
  }

  // ==========================================
  // KIDS WALLET PAGE
  // ==========================================
  if (["/kids", "/kids.html", "/wallet", "/wallet.html"].includes(location.pathname)) {
    request("/api/dashboard").then((data) => {
      const { user, balances, goals } = data;
      const currency = user.currency || getCurrency();
      if (user.role !== "child") return window.location.replace("/dashboard");

      const greeting = $("h1");
      if (greeting) greeting.textContent = `Hey ${user.fullName.split(" ")[0]}, welcome to your wallet!`;

      const amounts = $$(".text-3xl.font-extrabold");
      if (amounts[0]) amounts[0].textContent = formatMoney(balances.everyday, currency);
      if (amounts[1]) amounts[1].textContent = formatMoney(balances.savings, currency);
      if (amounts[2]) amounts[2].textContent = formatMoney(balances.emergency, currency);

      const activeGoal = goals[0];
      if (activeGoal) {
        const goalTitle = $(".bg-card h3.font-bold");
        if (goalTitle) goalTitle.textContent = `Goal: ${activeGoal.name}`;
        const goalSub = $(".bg-card p.text-xs.text-gray-400");
        if (goalSub) goalSub.textContent = `${activeGoal.progressPercentage}% completed · Target: ${formatMoney(activeGoal.targetCents, currency)}`;
        const goalBar = $(".bg-emerald-400.h-full");
        if (goalBar) goalBar.style.width = `${activeGoal.progressPercentage}%`;
        const raised = Array.from($$(".text-xs.text-gray-400")).find(el => el.textContent.includes("Raised:"));
        if (raised) raised.textContent = `Raised: ${formatMoney(activeGoal.currentCents, currency)}`;
      }

      // AI Chat prompt
      const startChat = Array.from($$("button")).find(button => button.textContent.includes("Start Chat"));
      startChat?.addEventListener("click", async () => {
        try {
          const res = await request("/api/ai-suggestion", {
            method: "POST",
            body: JSON.stringify({ amount: 50, currency })
          });
          show(`AI Buddy (${res.tone}): ${res.explanation}`);
        } catch {
          show("AI Buddy: Keep adding to your goal—every deposit gets you closer to unlocking your reward!");
        }
      });
    }).catch(console.error);
  }
})();
