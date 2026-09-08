import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// Extend Express Request type globally
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      id?: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientHeader = req.headers["x-request-id"];
  let requestId: string;

  if (typeof clientHeader === "string" && clientHeader.trim().length > 0) {
    requestId = clientHeader.trim();
  } else {
    requestId = randomUUID();
  }

  req.requestId = requestId;
  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
};
