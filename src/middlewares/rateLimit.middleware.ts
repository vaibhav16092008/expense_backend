import rateLimit from "express-rate-limit";
import { Response } from "express";
import { sendError } from "../utils/response.js";

/**
 * Interface definition for rate limit store backends.
 * Architectural Note:
 * The current implementation uses in-memory storage suitable for single-instance deployments.
 * When horizontally scaling across multiple instances, implement this interface using Redis (e.g. rate-limit-redis)
 * and pass the custom store to express-rate-limit without modifying route definitions or middleware signatures.
 */
export interface IRateLimitStoreConfig {
  windowMs: number;
  max: number;
}

/**
 * Strict rate limiter for authentication endpoints (login & register).
 * Limits each IP to 10 requests per 15-minute window in production/development.
 * Skipped automatically in test environment unless x-enable-rate-limit header is present.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === "test" && !req.headers["x-enable-rate-limit"],
  handler: (_req, res: Response) => {
    sendError(
      res,
      429,
      "Too many authentication attempts, please try again later"
    );
  },
});

/**
 * Strict rate limiter for sensitive operations (password change & account deletion).
 * Limits each IP to 5 requests per 15-minute window in production/development.
 * Skipped automatically in test environment unless x-enable-rate-limit header is present.
 */
export const sensitiveUserOpsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === "test" && !req.headers["x-enable-rate-limit"],
  handler: (_req, res: Response) => {
    sendError(
      res,
      429,
      "Too many attempts for sensitive operation, please try again later"
    );
  },
});
