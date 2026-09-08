import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { incrementRequestCount, incrementErrorCount } from "../utils/metrics.js";

const HEALTH_PATHS = new Set([
  "/health",
  "/health/live",
  "/health/ready",
  "/api/health",
  "/api/health/live",
  "/api/health/ready",
  "/metrics",
  "/api/metrics",
]);

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  incrementRequestCount();

  res.on("finish", () => {
    try {
      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;

      if (statusCode >= 400) {
        incrementErrorCount();
      }

      // Suppress excessive logging for health check endpoints unless error occurs
      const path = req.originalUrl || req.url;
      const basePath = path.split("?")[0];
      if (HEALTH_PATHS.has(basePath) && statusCode < 400) {
        return;
      }

      logger.info(
        "HTTP_RESPONSE",
        `${req.method} ${basePath} ${statusCode} - ${durationMs}ms`,
        {
          method: req.method,
          path: basePath,
          statusCode,
          durationMs,
        },
        req.requestId
      );
    } catch {
      // Logging failure must never interrupt or throw error
    }
  });

  next();
};
