import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  createRecurringTransactionSchema,
  updateRecurringTransactionSchema,
  recurringTransactionQuerySchema,
} from "../validators/recurringTransaction.validator.js";
import {
  createRecurringTransaction,
  getRecurringTransactions,
  getRecurringTransactionById,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  processDueRecurringTransactions,
} from "../services/recurringTransaction.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const createRecurringTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const validatedData = createRecurringTransactionSchema.parse(req.body);
    const recurring = await createRecurringTransaction(userId, validatedData);

    sendSuccess(
      res,
      201,
      "Recurring transaction created successfully",
      recurring
    );
  } catch (error) {
    next(error);
  }
};

export const getRecurringTransactionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = recurringTransactionQuerySchema.parse(req.query);
    const list = await getRecurringTransactions(userId, query);

    sendSuccess(
      res,
      200,
      "Recurring transactions fetched successfully",
      list
    );
  } catch (error) {
    next(error);
  }
};

export const getRecurringTransactionByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const id = req.params.id as string;
    const recurring = await getRecurringTransactionById(userId, id);

    sendSuccess(
      res,
      200,
      "Recurring transaction fetched successfully",
      recurring
    );
  } catch (error) {
    next(error);
  }
};

export const updateRecurringTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const id = req.params.id as string;
    const validatedData = updateRecurringTransactionSchema.parse(req.body);
    const updated = await updateRecurringTransaction(userId, id, validatedData);

    sendSuccess(
      res,
      200,
      "Recurring transaction updated successfully",
      updated
    );
  } catch (error) {
    next(error);
  }
};

export const deleteRecurringTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const id = req.params.id as string;
    await deleteRecurringTransaction(userId, id);

    sendSuccess(res, 200, "Recurring transaction deleted successfully");
  } catch (error) {
    next(error);
  }
};

export const pauseRecurringTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const id = req.params.id as string;
    const paused = await pauseRecurringTransaction(userId, id);

    sendSuccess(
      res,
      200,
      "Recurring transaction paused successfully",
      paused
    );
  } catch (error) {
    next(error);
  }
};

export const resumeRecurringTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const id = req.params.id as string;
    const resumed = await resumeRecurringTransaction(userId, id);

    sendSuccess(
      res,
      200,
      "Recurring transaction resumed successfully",
      resumed
    );
  } catch (error) {
    next(error);
  }
};

export const processDueRecurringTransactionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    // Strictly user-scoped processing
    const summary = await processDueRecurringTransactions(userId);

    sendSuccess(
      res,
      200,
      "Recurring transactions processed successfully",
      summary
    );
  } catch (error) {
    next(error);
  }
};
