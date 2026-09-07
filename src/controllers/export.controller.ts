import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  exportTransactionsQuerySchema,
  exportReportQuerySchema,
} from "../validators/export.validator.js";
import {
  exportTransactionsCsv,
  exportReportCsv,
  exportFinancialDataJson,
} from "../services/export.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const exportTransactionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const query = exportTransactionsQuerySchema.parse(req.query);
    const today = new Date().toISOString().split("T")[0]!;

    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expenseiq_transactions_${today}.csv"`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    await exportTransactionsCsv(userId, query, res);
    res.end();
  } catch (error) {
    next(error);
  }
};

export const exportReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const query = exportReportQuerySchema.parse(req.query);
    const today = new Date().toISOString().split("T")[0]!;

    const csvContent = await exportReportCsv(userId, query);

    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expenseiq_report_${query.type}_${today}.csv"`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    res.send(csvContent);
  } catch (error) {
    next(error);
  }
};

export const exportFinancialJsonHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const exportData = await exportFinancialDataJson(userId);

    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, 200, "Financial data exported successfully", exportData);
  } catch (error) {
    next(error);
  }
};
