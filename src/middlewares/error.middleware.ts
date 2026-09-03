import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/response.js";

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  if (err instanceof ZodError) {
    const firstIssue = err.errors[0];
    const message = firstIssue ? firstIssue.message : "Validation failed";
    sendError(res, 400, message);
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message);
    return;
  }

  // Handle Express body-parser size limit error (100kb limit)
  if (
    err &&
    typeof err === "object" &&
    ("type" in err && err.type === "entity.too.large" || "status" in err && (err as { status: number }).status === 413)
  ) {
    sendError(res, 413, "Request body size exceeds 100kb limit");
    return;
  }

  // Server internal logging (never exposed to client)
  if (process.env.NODE_ENV !== "test") {
    console.error("Unhandled Error:", err);
  }

  // Sanitize internal errors in production
  sendError(res, 500, "Internal server error");
};
