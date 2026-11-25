import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, IS_PRODUCTION } from "../config";
import db from "../db";

export interface AuthenticatedUser {
  id: number;
  fullName: string;
  email: string;
  role: "PARENT" | "CHILD" | "INDIVIDUAL";
  accountMode: "FAMILY" | "MYSELF" | "TEEN";
  age: number;
  currency: string;
  parentId: number | null;
  accountabilityPartnerEmail: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function signToken(user: { id: number; email: string; role: string; accountMode: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      accountMode: user.accountMode
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax"
  });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Authentication required", loggedIn: false });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await db.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists", loggedIn: false });
    }

    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      accountMode: user.accountMode,
      age: user.age,
      currency: user.currency,
      parentId: user.parentId,
      accountabilityPartnerEmail: user.accountabilityPartnerEmail
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session", loggedIn: false });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
      const user = await db.user.findUnique({ where: { id: decoded.id } });
      if (user) {
        req.user = {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          accountMode: user.accountMode,
          age: user.age,
          currency: user.currency,
          parentId: user.parentId,
          accountabilityPartnerEmail: user.accountabilityPartnerEmail
        };
      }
    }
  } catch {
    // Ignore invalid token in optionalAuth
  }
  next();
}
