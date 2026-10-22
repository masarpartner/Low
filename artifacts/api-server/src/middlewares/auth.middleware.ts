import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export interface SessionCookiePayload {
  username: string;
  userId?: string;
  role?: string;
  displayName?: string;
  issuedAt: number;
}

const SESSION_COOKIE_NAME = "court_session_auth";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setSessionCookie(
  res: Response,
  userData: string | { username: string; userId?: string; role?: string; displayName?: string },
): void {
  const payload: SessionCookiePayload =
    typeof userData === "string"
      ? { username: userData, issuedAt: Date.now(), role: "admin" }
      : {
          username: userData.username,
          userId: userData.userId,
          role: userData.role || "staff",
          displayName: userData.displayName,
          issuedAt: Date.now(),
        };

  res.cookie(SESSION_COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "strict",
    secure: env.isProduction,
    signed: false,
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

function readSessionCookie(req: Request): SessionCookiePayload | null {
  let raw: any = req.cookies?.[SESSION_COOKIE_NAME] || req.signedCookies?.[SESSION_COOKIE_NAME];

  if (!raw && req.headers.cookie) {
    const match = req.headers.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      raw = decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
    }
  }

  if (!raw) {
    return null;
  }

  if (typeof raw === "object" && raw !== null) {
    return raw as SessionCookiePayload;
  }

  if (typeof raw === "string") {
    if (raw.startsWith("s:")) {
      raw = raw.slice(2).split(".")[0];
    }
    if (raw.startsWith("j:")) {
      raw = raw.slice(2);
    }
    try {
      const parsed = JSON.parse(raw) as SessionCookiePayload;
      if (
        typeof parsed.username !== "string" ||
        typeof parsed.issuedAt !== "number"
      ) {
        return null;
      }
      if (Date.now() - parsed.issuedAt > SESSION_MAX_AGE_MS) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionCookiePayload;
    }
  }
}

/** Populates `req.authUser` when a valid session cookie is present, without rejecting the request. */
export function attachAuthUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const session = readSessionCookie(req);
  if (session) {
    req.authUser = session;
  }
  next();
}

/** Rejects the request with 401 unless a valid session cookie is present. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

/** Rejects the request with 403 unless the authenticated user has the 'admin' role. */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.authUser.role !== "admin") {
    res.status(403).json({ error: "هذا الإجراء يتطلب صلاحيات المشرف العام (Admin)." });
    return;
  }
  next();
}

/**
 * Rejects requests with 403 if the user's subscription is suspended or expired.
 * Stops access to:
 * - Excel data read/write (sessions, tasks, poa, judgments)
 * - Report generation and saving
 * - AI message extraction
 */
export function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Admins always have access
  if (req.authUser.role === "admin") {
    return next();
  }

  try {
    const { loadLocalUsers } = require("../services/supabase.service");
    const users = loadLocalUsers();
    const current = users.find(
      (u: any) => u.id === req.authUser?.userId || u.username === req.authUser?.username,
    );

    if (current) {
      if (current.status === "suspended") {
        res.status(403).json({
          error: "تم إيقاف اشتراك هذا الحساب مؤقتاً من قِبل إدارة المنظومة. تم إيقاف المزامنة مع الإكسل والتقارير والذكاء الاصطناعي.",
          isSuspended: true,
        });
        return;
      }

      if (current.subscription_end_date) {
        const expiry = new Date(current.subscription_end_date).getTime();
        if (expiry < Date.now()) {
          res.status(403).json({
            error: "عذراً، انتهت فترة اشتراكك في المنظومة. تم إيقاف اتصال النظام بالإكسل وتوليد التقارير وتحليل الرسائل بالذكاء الاصطناعي. يرجى التواصل مع المشرف العام لتجديد الاشتراك.",
            isExpired: true,
            subscription_end_date: current.subscription_end_date,
          });
          return;
        }
      }
    }
  } catch (err) {
    // If lookup fails, allow next
  }

  next();
}

