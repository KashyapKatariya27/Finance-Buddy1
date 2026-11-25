import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { CLIENT_URL, IS_PRODUCTION, UPLOAD_DIR, DISCLAIMER } from "./config";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { childrenRouter } from "./routes/children";
import { walletRouter } from "./routes/wallet";
import { goalsRouter } from "./routes/goals";
import { choresRouter } from "./routes/chores";
import { requestsRouter } from "./routes/requests";
import { transactionsRouter } from "./routes/transactions";
import { learningRouter } from "./routes/learning";
import { aiRouter } from "./routes/ai";
import { seedDemoAccounts } from "./seed";
import { requireAuth } from "./middleware/auth";

export const app = express();

// Security & Core Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(
  cors({
    origin: IS_PRODUCTION ? CLIENT_URL : true,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());

// Ensure uploads directory exists and serve uploaded bills
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOAD_DIR));

// Seed demo data automatically on boot if empty
seedDemoAccounts().catch(console.error);

// Mandatory Disclaimer Header
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-FinanceBuddy-Disclaimer", DISCLAIMER);
  next();
});

// Health Endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    app: "FinanceBuddy",
    theme: "Midnight Aurora",
    disclaimer: DISCLAIMER
  });
});

// Primary API Routes
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/children", childrenRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/chores", choresRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/learning", learningRouter);
app.use("/api/ai", aiRouter);

// Aliases for unified frontend compatibility
app.use("/api/approvals", requestsRouter);
app.use("/api/family/children", childrenRouter);
app.get("/api/me", requireAuth, (_req, res) => res.redirect(307, "/api/auth/me"));
app.post("/api/plan-split", requireAuth, (_req, res) => res.redirect(307, "/api/wallet/plan-split"));
app.post("/api/currency", requireAuth, (_req, res) => res.redirect(307, "/api/wallet/currency"));
app.post("/api/family/funds", requireAuth, (_req, res) => res.redirect(307, "/api/wallet/fund"));
app.get("/api/family/transactions", requireAuth, (_req, res) => res.redirect(307, "/api/transactions"));

// Serve compiled React Vite app in production / built dist
const clientDistPath = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else {
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      message: "FinanceBuddy API Server",
      status: "running",
      disclaimer: DISCLAIMER
    });
  });
}

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

export default app;
