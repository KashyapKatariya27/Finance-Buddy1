import { z } from "zod";

export const DISCLAIMER = "FinanceBuddy is a goal-planning and learning tool. All balances are simulated; no real money is held or moved.";

export const RoleEnum = z.enum(["PARENT", "CHILD", "INDIVIDUAL"]);
export type Role = z.infer<typeof RoleEnum>;

export const AccountModeEnum = z.enum(["FAMILY", "MYSELF", "TEEN"]);
export type AccountMode = z.infer<typeof AccountModeEnum>;

export const GoalCategoryEnum = z.enum([
  "education",
  "gadget",
  "travel",
  "emergency",
  "business",
  "health",
  "wedding",
  "home",
  "other"
]);
export type GoalCategory = z.infer<typeof GoalCategoryEnum>;

export const GoalPriorityEnum = z.enum(["low", "medium", "high"]);
export type GoalPriority = z.infer<typeof GoalPriorityEnum>;

export const GoalStatusEnum = z.enum(["active", "completed", "cancelled"]);
export type GoalStatus = z.infer<typeof GoalStatusEnum>;

export const ApprovalStatusEnum = z.enum(["pending", "cooling_off", "approved", "rejected", "completed"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const ApprovalTypeEnum = z.enum(["allowance", "early_goal_withdrawal", "emergency_drawdown"]);
export type ApprovalType = z.infer<typeof ApprovalTypeEnum>;

export const CurrencyEnum = z.enum(["INR", "USD"]);
export type Currency = z.infer<typeof CurrencyEnum>;

// Validation Schemas
export const RegisterSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  accountMode: AccountModeEnum.default("FAMILY"),
  role: RoleEnum.default("INDIVIDUAL"),
  age: z.number().int().min(6).max(120).default(25),
  currency: CurrencyEnum.default("INR"),
  parentEmail: z.string().email().optional().or(z.literal("")),
  accountabilityPartnerEmail: z.string().email().optional().or(z.literal(""))
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CurrencySchema = z.object({
  currency: CurrencyEnum
});
export type CurrencyInput = z.infer<typeof CurrencySchema>;

export const PlanSplitSchema = z.object({
  everyday: z.number().int().min(0).max(100),
  emergency: z.number().int().min(0).max(100),
  savings: z.number().int().min(0).max(100)
}).refine(data => data.everyday + data.emergency + data.savings === 100, {
  message: "Split percentages must sum to 100%"
});
export type PlanSplitInput = z.infer<typeof PlanSplitSchema>;

export const GoalCreateSchema = z.object({
  name: z.string().min(2, "Goal name must be at least 2 characters").max(100),
  category: GoalCategoryEnum.default("other"),
  targetAmount: z.union([z.string(), z.number()]).transform(v => Number(v)).refine(n => n > 0, "Target amount must be positive"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD"),
  priority: GoalPriorityEnum.default("medium"),
  icon: z.string().max(10).default("🎯"),
  autoSaveAmount: z.union([z.string(), z.number()]).optional().transform(v => v ? Number(v) : 0),
  autoSaveFrequency: z.enum(["none", "weekly", "monthly", "percent_income"]).default("none"),
  roundUpEnabled: z.boolean().default(false)
});
export type GoalCreateInput = z.infer<typeof GoalCreateSchema>;

export const GoalDepositSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(v => Number(v)).refine(n => n > 0, "Deposit amount must be positive")
});
export type GoalDepositInput = z.infer<typeof GoalDepositSchema>;

export const SimulateSpendSchema = z.object({
  spendAmount: z.union([z.string(), z.number()]).transform(v => Number(v)).refine(n => n > 0, "Spend amount must be positive"),
  note: z.string().max(120).default("Simulated Card Purchase")
});
export type SimulateSpendInput = z.infer<typeof SimulateSpendSchema>;

export const GoalWithdrawSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(v => Number(v)).refine(n => n > 0, "Withdrawal amount must be positive"),
  reason: z.string().min(4, "Reason must be at least 4 characters").max(300).default("Goal Withdrawal")
});
export type GoalWithdrawInput = z.infer<typeof GoalWithdrawSchema>;

export const FinalizeCoolingOffSchema = z.object({
  simulate_bypass: z.boolean().optional().default(false)
});
export type FinalizeCoolingOffInput = z.infer<typeof FinalizeCoolingOffSchema>;

export const FundWalletSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(v => Number(v)).refine(n => n > 0, "Funding amount must be positive"),
  note: z.string().max(200).default("Wallet funded")
});
export type FundWalletInput = z.infer<typeof FundWalletSchema>;

export const ReviewApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"])
});
export type ReviewApprovalInput = z.infer<typeof ReviewApprovalSchema>;

export const LearningCompleteSchema = z.object({
  moduleId: z.string().min(1)
});
export type LearningCompleteInput = z.infer<typeof LearningCompleteSchema>;

export const AppEventSchema = z.object({
  action: z.string().min(1).max(80),
  details: z.string().max(500).optional().default("")
});
export type AppEventInput = z.infer<typeof AppEventSchema>;

export const AiSuggestionSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(v => Number(v)).refine(n => n > 0, "Amount must be positive"),
  splitPercentages: z.object({
    everydayPct: z.number().optional(),
    emergencyPct: z.number().optional(),
    savingPct: z.number().optional()
  }).optional(),
  studentName: z.string().optional(),
  age: z.number().optional(),
  role: z.string().optional(),
  accountMode: z.string().optional(),
  currency: CurrencyEnum.optional()
});
export type AiSuggestionInput = z.infer<typeof AiSuggestionSchema>;

// DTOs
export interface UserDTO {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  accountMode: AccountMode;
  age: number;
  currency: Currency;
  parentLinked: boolean;
  accountabilityPartnerEmail: string | null;
  splitEveryday: number;
  splitEmergency: number;
  splitSavings: number;
  monthlyExpensesCents: number;
  streakDays: number;
  disclaimer: string;
}

export interface GoalMilestones {
  m25: boolean;
  m50: boolean;
  m75: boolean;
  m100: boolean;
}

export interface GoalDTO {
  id: number;
  userId: number;
  name: string;
  category: GoalCategory;
  targetCents: number;
  currentCents: number;
  target: number;
  current: number;
  deadline: string;
  priority: GoalPriority;
  icon: string;
  status: GoalStatus;
  autoSaveCents: number;
  autoSaveFrequency: string;
  roundUpEnabled: boolean;
  progressPercentage: number;
  remainingCents: number;
  requiredPerWeekCents: number;
  requiredPerMonthCents: number;
  daysRemaining: number;
  onTrackStatus: "on_track" | "behind" | "ahead" | "completed";
  daysAheadOrBehind: number;
  projectedCompletionDate: string;
  milestones: GoalMilestones;
  isCompleted: boolean;
  createdAt: string;
}

export interface ApprovalDTO {
  id: number;
  childId: number;
  parentId?: number | null;
  partnerEmail?: string | null;
  amountCents: number;
  amount: number;
  reason: string;
  status: ApprovalStatus;
  reviewedBy?: number | null;
  goalId?: number | null;
  unlockAt?: string | null;
  coolingOff: boolean;
  delayDays: number;
  type: ApprovalType;
  isUnlocked?: boolean;
  createdAt: string;
}

export interface TransactionDTO {
  id: number;
  userId: number;
  type: string;
  amountCents: number;
  amount: number;
  note: string;
  createdAt: string;
  accountName?: string;
}

export interface EmergencyGuidanceDTO {
  monthlyExpenses: number;
  monthsCovered: number;
  target3Months: number;
  target6Months: number;
  status: "Fully Funded (6+ Mos)" | "Healthy Buffer (3-6 Mos)" | "Building Reserve (< 3 Mos)";
}

export interface PlanSplitDTO {
  everyday: number;
  emergency: number;
  savings: number;
  preset: {
    category: string;
    name: string;
    everyday: number;
    emergency: number;
    savings: number;
  };
}

export interface DashboardResponseDTO {
  user: UserDTO;
  balances: {
    everyday: number;
    emergency: number;
    savings: number;
    total: number;
  };
  emergencyGuidance: EmergencyGuidanceDTO;
  planSplit: PlanSplitDTO;
  goals: GoalDTO[];
  pendingApproval: { id: number; amount: number; reason: string } | null;
  coolingOffRequests: Array<{
    id: number;
    amount: number;
    reason: string;
    unlockAt: string | null;
    delayDays: number;
    goalId: number | null;
    isUnlocked: boolean;
  }>;
  disclaimer: string;
}

export interface LearningModuleDTO {
  id: string;
  level: "Kids" | "Teens" | "Adults";
  title: string;
  description: string;
  tag: string;
  points: number;
  icon: string;
  isCompleted: boolean;
}

export interface LearningHubResponseDTO {
  modules: LearningModuleDTO[];
  defaultLevel: "Kids" | "Teens" | "Adults";
  streakDays: number;
  disclaimer: string;
}

export interface AiSuggestionResponseDTO {
  explanation: string;
  source: string;
  tone: "playful" | "empowering" | "motivating";
  insights: string[];
  split: {
    everydayAmt: number;
    emergencyAmt: number;
    savingAmt: number;
  };
}

// Age preset function
export function getPresetForAge(age: number) {
  const a = Number(age) || 25;
  if (a <= 12) {
    return { category: "child", name: "Child (6-12)", label: "Child (6-12)", everyday: 50, emergency: 20, savings: 30 };
  }
  if (a <= 17) {
    return { category: "teen", name: "Teen (13-17)", label: "Teen (13-17)", everyday: 50, emergency: 30, savings: 20 };
  }
  if (a <= 25) {
    return { category: "young_adult", name: "Young Adult (18-25)", label: "Young Adult (18-25)", everyday: 50, emergency: 20, savings: 30 };
  }
  return { category: "adult", name: "Adult (26+)", label: "Adult (26+)", everyday: 50, emergency: 30, savings: 20 };
}

// Currency format helper
export function formatMoney(cents: number, currency: Currency = "INR"): string {
  const locale = currency === "USD" ? "en-US" : "en-IN";
  const num = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(num);
}
