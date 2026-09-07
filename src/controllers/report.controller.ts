import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  reportDateRangeSchema,
  cashFlowQuerySchema,
  savingsQuerySchema,
  customReportQuerySchema,
} from "../validators/report.validator.js";
import {
  getFinancialSummaryReport,
  getCashFlowReport,
  getCategorySpendingReport,
  getBudgetPerformanceReport,
  getSavingsReport,
  getCustomReport,
} from "../services/report.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const getFinancialSummaryReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = reportDateRangeSchema.parse(req.query);
    const summary = await getFinancialSummaryReport(userId, query);

    sendSuccess(res, 200, "Financial summary report fetched successfully", summary);
  } catch (error) {
    next(error);
  }
};

export const getCashFlowReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = cashFlowQuerySchema.parse(req.query);
    const cashFlow = await getCashFlowReport(userId, query);

    sendSuccess(res, 200, "Cash flow report fetched successfully", cashFlow);
  } catch (error) {
    next(error);
  }
};

export const getCategoryReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = reportDateRangeSchema.parse(req.query);
    const categories = await getCategorySpendingReport(userId, query);

    sendSuccess(res, 200, "Category spending report fetched successfully", categories);
  } catch (error) {
    next(error);
  }
};

export const getBudgetReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = reportDateRangeSchema.parse(req.query);
    const budgets = await getBudgetPerformanceReport(userId, query);

    sendSuccess(res, 200, "Budget performance report fetched successfully", budgets);
  } catch (error) {
    next(error);
  }
};

export const getSavingsReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = savingsQuerySchema.parse(req.query);
    const savings = await getSavingsReport(userId, query);

    sendSuccess(res, 200, "Savings report fetched successfully", savings);
  } catch (error) {
    next(error);
  }
};

export const getCustomReportHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = customReportQuerySchema.parse(req.query);
    const custom = await getCustomReport(userId, query);

    sendSuccess(res, 200, "Custom report fetched successfully", custom);
  } catch (error) {
    next(error);
  }
};
