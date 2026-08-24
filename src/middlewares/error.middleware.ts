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

  // Server internal logging (never exposed to client)
  console.error("Unhandled Error:", err);

  sendError(res, 500, "Something went wrong");
};
