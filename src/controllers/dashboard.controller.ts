import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  dashboardQuerySchema,
  monthlyQuerySchema,
  trendsQuerySchema,
} from "../validators/dashboard.validator.js";
import {
  getDashboardSummary,
  getMonthlyAnalytics,
  getCategoryAnalytics,
  getSpendingTrends,
  getBudgetOverview,
} from "../services/dashboard.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const getDashboardSummaryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = dashboardQuerySchema.parse(req.query);
    const summary = await getDashboardSummary(userId, query);

    sendSuccess(res, 200, "Dashboard summary fetched successfully", summary);
  } catch (error) {
    next(error);
  }
};

export const getMonthlyAnalyticsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = monthlyQuerySchema.parse(req.query);
    const monthly = await getMonthlyAnalytics(userId, query);

    sendSuccess(res, 200, "Monthly analytics fetched successfully", monthly);
  } catch (error) {
    next(error);
  }
};

export const getCategoryAnalyticsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = dashboardQuerySchema.parse(req.query);
    const categories = await getCategoryAnalytics(userId, query);

    sendSuccess(res, 200, "Category analytics fetched successfully", categories);
  } catch (error) {
    next(error);
  }
};

export const getSpendingTrendsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = trendsQuerySchema.parse(req.query);
    const trends = await getSpendingTrends(userId, query);

    sendSuccess(res, 200, "Spending trends fetched successfully", trends);
  } catch (error) {
    next(error);
  }
};

export const getBudgetOverviewHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const overview = await getBudgetOverview(userId);

    sendSuccess(res, 200, "Budget overview fetched successfully", overview);
  } catch (error) {
    next(error);
  }
};
