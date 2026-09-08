import { Request, Response, NextFunction } from "express";

/**
 * Custom lightweight security headers middleware to supplement or standardize header policy.
 */
export const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0");
  next();
};
