import { Prisma, TransactionType, CategoryType } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionQueryInput,
} from "../validators/transaction.validator.js";
import { AppError } from "../middlewares/error.middleware.js";

export interface TransactionResponse {
  id: string;
  amount: string;
  type: TransactionType;
  category: {
    id: string;
    name: string;
    type: CategoryType;
  };
  note: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const formatTransaction = (
  transaction: {
    id: string;
    amount: Prisma.Decimal;
    type: TransactionType;
    note: string | null;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    category: {
      id: string;
      name: string;
      type: CategoryType;
    };
  }
): TransactionResponse => ({
  id: transaction.id,
  amount: transaction.amount.toFixed(2),
  type: transaction.type,
  category: {
    id: transaction.category.id,
    name: transaction.category.name,
    type: transaction.category.type,
  },
  note: transaction.note,
  date: transaction.date,
  createdAt: transaction.createdAt,
  updatedAt: transaction.updatedAt,
});

export const createTransaction = async (
  userId: string,
  input: CreateTransactionInput
): Promise<TransactionResponse> => {
  // 1. Verify category exists and belongs to the authenticated user
  const category = await prisma.category.findFirst({
    where: {
      id: input.categoryId,
      userId,
    },
  });

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  // 2. Verify transaction type matches category type
  if (category.type !== (input.type as unknown as CategoryType)) {
    throw new AppError(
      "Transaction type does not match category type",
      400
    );
  }

  // 3. Create transaction
  const transaction = await prisma.transaction.create({
    data: {
      amount: new Prisma.Decimal(input.amount),
      type: input.type as TransactionType,
      categoryId: input.categoryId,
      note: input.note ? input.note.trim() : null,
      date: new Date(input.date),
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return formatTransaction(transaction);
};

export const getTransactions = async (
  userId: string,
  filters: TransactionQueryInput
): Promise<TransactionResponse[]> => {
  const where: Prisma.TransactionWhereInput = {
    userId,
  };

  if (filters.type) {
    where.type = filters.type as TransactionType;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      if (filters.startDate.length === 10) {
        start.setUTCHours(0, 0, 0, 0);
      }
      where.date.gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      if (filters.endDate.length === 10) {
        end.setUTCHours(23, 59, 59, 999);
      }
      where.date.lte = end;
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return transactions.map(formatTransaction);
};

export const getTransactionById = async (
  userId: string,
  transactionId: string
): Promise<TransactionResponse> => {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  return formatTransaction(transaction);
};

export const updateTransaction = async (
  userId: string,
  transactionId: string,
  input: UpdateTransactionInput
): Promise<TransactionResponse> => {
  // 1. Verify transaction exists and belongs to authenticated user
  const existing = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
    include: {
      category: true,
    },
  });

  if (!existing) {
    throw new AppError("Transaction not found", 404);
  }

  const targetCategoryId = input.categoryId ?? existing.categoryId;
  const targetType = (input.type as TransactionType) ?? existing.type;

  // 2. Validate category and type consistency
  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        userId,
      },
    });

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (category.type !== (targetType as unknown as CategoryType)) {
      throw new AppError(
        "Transaction type does not match category type",
        400
      );
    }
  } else if (input.type) {
    if (existing.category.type !== (input.type as unknown as CategoryType)) {
      throw new AppError(
        "Transaction type does not match category type",
        400
      );
    }
  }

  // 3. Update transaction
  const updated = await prisma.transaction.update({
    where: {
      id: transactionId,
    },
    data: {
      amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
      type: input.type ? (input.type as TransactionType) : undefined,
      categoryId: targetCategoryId,
      note:
        input.note !== undefined
          ? input.note
            ? input.note.trim()
            : null
          : undefined,
      date: input.date ? new Date(input.date) : undefined,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return formatTransaction(updated);
};

export const deleteTransaction = async (
  userId: string,
  transactionId: string
): Promise<TransactionResponse> => {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  await prisma.transaction.delete({
    where: {
      id: transactionId,
    },
  });

  return formatTransaction(transaction);
};
