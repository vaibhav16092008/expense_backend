import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { isShuttingDown } from "../config/appState.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getMetricsData } from "../utils/metrics.js";
import { logger } from "../utils/logger.js";

export const getHealth = (_req: Request, res: Response): void => {
  sendSuccess(res, 200, "ExpenseIQ API is healthy", {
    status: "ok",
    timestamp: new Date().toISOString(),
  });
};

export const getLiveness = (_req: Request, res: Response): void => {
  sendSuccess(res, 200, "Liveness check passed", {
    status: "ok",
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const getReadiness = async (_req: Request, res: Response): Promise<void> => {
  if (isShuttingDown()) {
    sendError(res, 503, "Service unavailable: application is shutting down");
    return;
  }

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database readiness check timed out")), 5000)
    );

    await Promise.race([prisma.$queryRaw`SELECT 1`, timeoutPromise]);

    sendSuccess(res, 200, "Application is ready to process requests", {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("DATABASE_ERROR", "Readiness probe failed database connectivity check", error);
    sendError(res, 503, "Database connection is unhealthy");
  }
};

export const getMetrics = (_req: Request, res: Response): void => {
  const metrics = getMetricsData();
  sendSuccess(res, 200, "Application metrics retrieved successfully", metrics);
};
