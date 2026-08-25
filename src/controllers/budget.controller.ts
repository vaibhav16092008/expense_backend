import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetQuerySchema,
} from "../validators/budget.validator.js";
import {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
} from "../services/budget.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const createBudgetHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const validatedData = createBudgetSchema.parse(req.body);
    const budget = await createBudget(userId, validatedData);

    sendSuccess(res, 201, "Budget created successfully", budget);
  } catch (error) {
    next(error);
  }
};

export const getBudgetsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = budgetQuerySchema.parse(req.query);
    const budgets = await getBudgets(userId, query);

    sendSuccess(res, 200, "Budgets fetched successfully", budgets);
  } catch (error) {
    next(error);
  }
};

export const getBudgetByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const budget = await getBudgetById(userId, req.params.id as string);

    sendSuccess(res, 200, "Budget fetched successfully", budget);
  } catch (error) {
    next(error);
  }
};

export const updateBudgetHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const validatedData = updateBudgetSchema.parse(req.body);
    const budget = await updateBudget(userId, req.params.id as string, validatedData);

    sendSuccess(res, 200, "Budget updated successfully", budget);
  } catch (error) {
    next(error);
  }
};

export const deleteBudgetHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    await deleteBudget(userId, req.params.id as string);

    sendSuccess(res, 200, "Budget deleted successfully");
  } catch (error) {
    next(error);
  }
};
