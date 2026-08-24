import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
} from "../validators/transaction.validator.js";
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from "../services/transaction.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const createTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const validatedData = createTransactionSchema.parse(req.body);
    const transaction = await createTransaction(userId, validatedData);

    sendSuccess(res, 201, "Transaction created successfully", transaction);
  } catch (error) {
    next(error);
  }
};

export const getTransactionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const query = transactionQuerySchema.parse(req.query);
    const transactions = await getTransactions(userId, query);

    sendSuccess(res, 200, "Transactions fetched successfully", transactions);
  } catch (error) {
    next(error);
  }
};

export const getTransactionByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const id = req.params.id as string;
    const transaction = await getTransactionById(userId, id);

    sendSuccess(res, 200, "Transaction fetched successfully", transaction);
  } catch (error) {
    next(error);
  }
};

export const updateTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const id = req.params.id as string;
    const validatedData = updateTransactionSchema.parse(req.body);
    const transaction = await updateTransaction(userId, id, validatedData);

    sendSuccess(res, 200, "Transaction updated successfully", transaction);
  } catch (error) {
    next(error);
  }
};

export const deleteTransactionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const id = req.params.id as string;
    await deleteTransaction(userId, id);

    sendSuccess(res, 200, "Transaction deleted successfully");
  } catch (error) {
    next(error);
  }
};
