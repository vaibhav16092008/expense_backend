import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, TokenPayload } from "../utils/token.js";
import { sendError } from "../utils/response.js";

/**
 * JWT Bearer Authentication Middleware.
 * Note: Access tokens are verified using JWT_ACCESS_SECRET.
 * TODO: Refresh Token rotation and session revocation planned for Phase 2 authentication enhancement.
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "Authentication required");
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    sendError(res, 401, "Authentication required");
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, "Invalid or expired token");
  }
};
