import dotenv from "dotenv";
dotenv.config();

export const PORT = Number(process.env.PORT || 5000);
export const HOST = process.env.HOST || "0.0.0.0";
export const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "finance-buddy-midnight-aurora-secret-key-2026";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
export const DISCLAIMER = "FinanceBuddy is a goal-planning and learning tool. All balances are simulated; no real money is held or moved.";
