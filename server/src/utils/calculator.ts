export interface GoalPacing {
  centsRemaining: number;
  percent: number;
  daysRemaining: number;
  weeksRemaining: number;
  monthsRemaining: number;
  requiredPerWeekCents: number;
  requiredPerMonthCents: number;
  onTrack: boolean;
  projectedCompletionDate: string;
  milestones: {
    m25: boolean;
    m50: boolean;
    m75: boolean;
    m100: boolean;
  };
  milestoneMessage: string;
}

export function calculateGoalPacing(goal: {
  targetCents: number;
  currentCents: number;
  deadline: string;
  createdAt?: string | Date;
}): GoalPacing {
  const target = Math.max(1, goal.targetCents);
  const current = Math.max(0, goal.currentCents);
  const centsRemaining = Math.max(0, target - current);
  const percent = Math.min(100, Math.floor((current / target) * 100));

  const now = new Date();
  const deadlineDate = new Date(goal.deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
  const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4375));

  const requiredPerWeekCents = centsRemaining > 0 ? Math.ceil(centsRemaining / weeksRemaining) : 0;
  const requiredPerMonthCents = centsRemaining > 0 ? Math.ceil(centsRemaining / monthsRemaining) : 0;

  // Track status comparison
  const created = goal.createdAt ? new Date(goal.createdAt) : new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
  const totalDurationMs = Math.max(1000 * 60 * 60 * 24, deadlineDate.getTime() - created.getTime());
  const elapsedMs = Math.max(0, now.getTime() - created.getTime());
  const expectedProgress = Math.min(100, (elapsedMs / totalDurationMs) * 100);
  const onTrack = percent >= expectedProgress || centsRemaining === 0;

  // Projected completion
  let projectedDate = deadlineDate;
  if (centsRemaining === 0) {
    projectedDate = now;
  } else if (current > 0 && elapsedMs > 0) {
    const ratePerDay = current / Math.max(1, elapsedMs / (1000 * 60 * 60 * 24));
    const daysNeeded = Math.ceil(centsRemaining / Math.max(1, ratePerDay));
    projectedDate = new Date(now.getTime() + daysNeeded * 24 * 60 * 60 * 1000);
  }

  const milestones = {
    m25: percent >= 25,
    m50: percent >= 50,
    m75: percent >= 75,
    m100: percent >= 100
  };

  let milestoneMessage = "Every step counts! Keep saving.";
  if (milestones.m100) {
    milestoneMessage = "🎉 Goal achieved! Congratulations on fulfilling your dream!";
  } else if (milestones.m75) {
    milestoneMessage = "🚀 75% Milestone unlocked! You are on the final stretch!";
  } else if (milestones.m50) {
    milestoneMessage = "🔥 Halfway there (50%)! Remarkable consistency!";
  } else if (milestones.m25) {
    milestoneMessage = "🌱 First quarter (25%) achieved! Strong momentum!";
  }

  return {
    centsRemaining,
    percent,
    daysRemaining,
    weeksRemaining,
    monthsRemaining,
    requiredPerWeekCents,
    requiredPerMonthCents,
    onTrack,
    projectedCompletionDate: projectedDate.toISOString().split("T")[0],
    milestones,
    milestoneMessage
  };
}

export function calculateEarlyWithdrawalDelay(
  goal: { targetCents: number; currentCents: number; deadline: string },
  withdrawalCents: number
): { delayDays: number; delayMessage: string } {
  const target = Math.max(1, goal.targetCents);
  const now = new Date();
  const deadlineDate = new Date(goal.deadline);
  const totalDays = Math.max(1, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const dailyPacing = target / totalDays;

  const delayDays = Math.max(1, Math.ceil(withdrawalCents / Math.max(1, dailyPacing)));
  return {
    delayDays,
    delayMessage: `Early withdrawal of funds will delay this goal's target date by approximately ${delayDays} day${delayDays > 1 ? "s" : ""}.`
  };
}

export function calculateEmergencyRunway(emergencyCents: number, monthlyExpensesCents: number) {
  const safeExpenses = Math.max(1, monthlyExpensesCents);
  const monthsCovered = Number((emergencyCents / safeExpenses).toFixed(1));
  const targetMonthsMin = 3;
  const targetMonthsMax = 6;
  const targetMinCents = safeExpenses * targetMonthsMin;
  const targetMaxCents = safeExpenses * targetMonthsMax;
  const isAdequate = monthsCovered >= targetMonthsMin;

  return {
    emergencyCents,
    monthlyExpensesCents: safeExpenses,
    monthsCovered,
    targetMonthsMin,
    targetMonthsMax,
    targetMinCents,
    targetMaxCents,
    isAdequate,
    guidance: isAdequate
      ? `You have ${monthsCovered} months of emergency runway. Excellent resilience!`
      : `You have ${monthsCovered} months covered. Build toward 3 to 6 months of expenses for optimal peace of mind.`
  };
}
