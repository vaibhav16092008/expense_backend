import { CookieOptions, Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { sendError } from "./response.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

/**
 * Returns centralized cookie configuration options for refresh tokens.
 */
export const getRefreshCookieOptions = (): CookieOptions => {
  const isProd = env.NODE_ENV === "production";
  
  return {
    httpOnly: true,
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    secure: isProd,
    sameSite: isProd ? "lax" : "lax",
  };
};

/**
 * Lightweight CSRF & Origin protection middleware for cookie-authenticated routes (/refresh, /logout).
 * Verifies custom header (X-Requested-With or X-ExpenseIQ-Client) and checks Origin against allowed list.
 */
export const validateCookieCsrf = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Allow test environment to bypass custom header if needed, but enforce when headers present
  const clientHeader =
    req.headers["x-requested-with"] || req.headers["x-expenseiq-client"];

  if (!clientHeader && process.env.NODE_ENV !== "test") {
    sendError(
      res,
      403,
      "CSRF protection: Custom client header (X-Requested-With or X-ExpenseIQ-Client) is required"
    );
    return;
  }

  const origin = req.headers.origin;
  if (origin && env.CORS_ORIGIN !== "*") {
    const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
    if (!allowedOrigins.includes(origin)) {
      sendError(res, 403, "CSRF protection: Origin not allowed");
      return;
    }
  }

  next();
};
