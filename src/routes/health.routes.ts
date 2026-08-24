import { Router, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  sendSuccess(res, 200, "ExpenseIQ API is healthy");
});

router.get("/db", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, 200, "Database connection is healthy");
  } catch (error) {
    console.error("Database health check failed:", error);
    sendError(res, 503, "Database connection is unhealthy");
  }
});

export const healthRouter = router;
