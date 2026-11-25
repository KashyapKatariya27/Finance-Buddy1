import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { PORT, HOST, DISCLAIMER } from "./config";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { goalsRouter } from "./routes/goals";
import { approvalsRouter } from "./routes/approvals";
import { learningRouter } from "./routes/learning";
import { aiRouter } from "./routes/ai";
import { familyRouter } from "./routes/family";
import { seedDemoAccounts } from "./seed";
import { requireAuth, AuthRequest } from "./middleware/auth";

export const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Seed initial demo data
seedDemoAccounts().catch(console.error);

// Disclaimer header middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-FinanceBuddy-Disclaimer", DISCLAIMER);
  next();
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/approvals", approvalsRouter);
app.use("/api/learning", learningRouter);
app.use("/api/ai", aiRouter);
app.use("/api/family", familyRouter);

// Aliases for unified frontend access
app.get("/api/me", requireAuth, async (req: AuthRequest, res: Response) => {
  res.redirect(307, "/api/auth/me");
});
app.get("/api/children", requireAuth, (req: Request, res: Response) => {
  res.redirect(307, "/api/family/children");
});
app.post("/api/funds", requireAuth, (req: Request, res: Response) => {
  res.redirect(307, "/api/family/funds");
});
app.get("/api/transactions", requireAuth, (req: Request, res: Response) => {
  res.redirect(307, "/api/family/transactions");
});
app.post("/api/plan-split", requireAuth, (req: Request, res: Response) => {
  res.redirect(307, "/api/dashboard/plan-split");
});
app.post("/api/currency", requireAuth, (req: Request, res: Response) => {
  res.redirect(307, "/api/dashboard/currency");
});

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    app: "FinanceBuddy",
    theme: "Midnight Aurora",
    disclaimer: DISCLAIMER
  });
});

// Client static file serving (Production or built dist)
const clientDistPath = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDistPath)) {
  console.log(`Serving static client files from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Endpoint not found" });
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else {
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      message: "FinanceBuddy Server API (Midnight Aurora)",
      status: "running",
      endpoints: ["/api/auth", "/api/dashboard", "/api/goals", "/api/approvals", "/api/learning", "/api/ai"],
      disclaimer: DISCLAIMER
    });
  });
}

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// Start listening if not in test import mode
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`✨ FinanceBuddy Server running at http://${HOST}:${PORT}`);
  });
}

export default app;
