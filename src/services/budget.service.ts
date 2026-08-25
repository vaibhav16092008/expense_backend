import { Prisma, BudgetType, BudgetPeriod, CategoryType } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import {
  CreateBudgetInput,
  UpdateBudgetInput,
  BudgetQueryInput,
  BudgetStatus,
  validateBudgetCrossFields,
} from "../validators/budget.validator.js";
import { AppError } from "../middlewares/error.middleware.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface BudgetResponse {
  id: string;
  amount: string;
  type: BudgetType;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  category: { id: string; name: string; type: CategoryType } | null;
  spent: string;
  remaining: string;
  percentage: number;
  status: BudgetStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Shape returned by Prisma when we include category
type BudgetWithCategory = {
  id: string;
  amount: Prisma.Decimal;
  type: BudgetType;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  userId: string;
  categoryId: string | null;
  category: { id: string; name: string; type: CategoryType } | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a date string to UTC midnight (start of day).
 */
function toStartOfDayUTC(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Normalise a date string to UTC end-of-day (23:59:59.999).
 */
function toEndOfDayUTC(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------

function calcStatus(percentage: number): BudgetStatus {
  if (percentage >= 100) return "EXCEEDED";
  if (percentage >= 90) return "CRITICAL";
  if (percentage >= 70) return "WARNING";
  return "ON_TRACK";
}

// ---------------------------------------------------------------------------
// Spending calculation
// ---------------------------------------------------------------------------

async function calcSpent(
  userId: string,
  budget: BudgetWithCategory
): Promise<Prisma.Decimal> {
  const where: Prisma.TransactionWhereInput = {
    userId,
    type: "EXPENSE",
    date: {
      gte: budget.startDate,
      lte: budget.endDate,
    },
  };

  if (budget.type === "CATEGORY" && budget.categoryId) {
    where.categoryId = budget.categoryId;
  }

  const agg = await prisma.transaction.aggregate({
    where,
    _sum: { amount: true },
  });

  return agg._sum.amount ?? new Prisma.Decimal(0);
}

// ---------------------------------------------------------------------------
// Format budget with computed fields
// ---------------------------------------------------------------------------

function formatBudget(
  budget: BudgetWithCategory,
  spent: Prisma.Decimal
): BudgetResponse {
  const amount = budget.amount;
  const remaining = amount.minus(spent);
  const percentage =
    amount.isZero()
      ? 0
      : Math.round(spent.div(amount).mul(100).toNumber());

  const now = new Date();
  const isActive = now >= budget.startDate && now <= budget.endDate;

  return {
    id: budget.id,
    amount: amount.toFixed(2),
    type: budget.type,
    period: budget.period,
    startDate: budget.startDate,
    endDate: budget.endDate,
    category: budget.category,
    spent: spent.toFixed(2),
    remaining: remaining.toFixed(2),
    percentage,
    status: calcStatus(percentage),
    isActive,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Overlap check
// ---------------------------------------------------------------------------

async function checkOverlap(
  userId: string,
  type: BudgetType,
  startDate: Date,
  endDate: Date,
  categoryId: string | null | undefined,
  excludeId?: string
): Promise<void> {
  const where: Prisma.BudgetWhereInput = {
    userId,
    type,
    // Date range overlap: existing.startDate <= new.endDate AND existing.endDate >= new.startDate
    startDate: { lte: endDate },
    endDate: { gte: startDate },
  };

  if (type === "CATEGORY") {
    where.categoryId = categoryId ?? undefined;
  }

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const existing = await prisma.budget.findFirst({ where });

  if (existing) {
    const msg =
      type === "CATEGORY"
        ? "A budget already exists for this category and period"
        : "A budget already exists for this period";
    throw new AppError(msg, 409);
  }
}

// ---------------------------------------------------------------------------
// Cross-field validation helper (reuse Zod logic in service for update merges)
// ---------------------------------------------------------------------------

function validateMergedBudgetFields(fields: {
  type: string;
  period: string;
  categoryId?: string | null;
  startDate: string;
  endDate: string;
}): void {
  const issues: z.ZodIssue[] = [];
  const ctx: z.RefinementCtx = {
    addIssue: (issue: z.IssueData) => {
      issues.push({ ...issue, path: issue.path ?? [] } as z.ZodIssue);
    },
    path: [],
  };

  validateBudgetCrossFields(fields, ctx);

  if (issues.length > 0) {
    throw new AppError(issues[0]!.message, 400);
  }
}

// ---------------------------------------------------------------------------
// Prisma select for budget with category
// ---------------------------------------------------------------------------

const budgetInclude = {
  category: {
    select: { id: true, name: true, type: true },
  },
} satisfies Prisma.BudgetInclude;

// ---------------------------------------------------------------------------
// createBudget
// ---------------------------------------------------------------------------

export const createBudget = async (
  userId: string,
  input: CreateBudgetInput
): Promise<BudgetResponse> => {
  const startDate = toStartOfDayUTC(input.startDate);
  const endDate = toEndOfDayUTC(input.endDate);

  // 1. Validate category for CATEGORY budgets
  if (input.type === "CATEGORY") {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId!, userId },
    });

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (category.type !== CategoryType.EXPENSE) {
      throw new AppError(
        "Budgets can only be created for expense categories",
        400
      );
    }
  }

  // 2. Check for overlapping budgets
  await checkOverlap(
    userId,
    input.type as BudgetType,
    startDate,
    endDate,
    input.categoryId
  );

  // 3. Create
  const budget = await prisma.budget.create({
    data: {
      amount: new Prisma.Decimal(input.amount),
      type: input.type as BudgetType,
      period: input.period as BudgetPeriod,
      startDate,
      endDate,
      userId,
      categoryId: input.categoryId ?? null,
    },
    include: budgetInclude,
  });

  const spent = await calcSpent(userId, budget);
  return formatBudget(budget, spent);
};

// ---------------------------------------------------------------------------
// getBudgets
// ---------------------------------------------------------------------------

export const getBudgets = async (
  userId: string,
  filters: BudgetQueryInput
): Promise<BudgetResponse[]> => {
  const where: Prisma.BudgetWhereInput = { userId };

  if (filters.type) {
    where.type = filters.type as BudgetType;
  }

  if (filters.period) {
    where.period = filters.period as BudgetPeriod;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.startDate || filters.endDate) {
    where.startDate = {};
    if (filters.startDate) {
      (where.startDate as Prisma.DateTimeFilter).gte = toStartOfDayUTC(
        filters.startDate
      );
    }
    if (filters.endDate) {
      where.endDate = { lte: toEndOfDayUTC(filters.endDate) };
    }
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: budgetInclude,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  // Calculate spending for all budgets (parallel queries)
  const spentAmounts = await Promise.all(
    budgets.map((b) => calcSpent(userId, b))
  );

  const formatted = budgets.map((b, i) => formatBudget(b, spentAmounts[i]!));

  // Apply status filter after calculation (status is not stored)
  if (filters.status) {
    return formatted.filter((b) => b.status === filters.status);
  }

  return formatted;
};

// ---------------------------------------------------------------------------
// getBudgetById
// ---------------------------------------------------------------------------

export const getBudgetById = async (
  userId: string,
  budgetId: string
): Promise<BudgetResponse> => {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
    include: budgetInclude,
  });

  if (!budget) {
    throw new AppError("Budget not found", 404);
  }

  const spent = await calcSpent(userId, budget);
  return formatBudget(budget, spent);
};

// ---------------------------------------------------------------------------
// updateBudget
// ---------------------------------------------------------------------------

export const updateBudget = async (
  userId: string,
  budgetId: string,
  input: UpdateBudgetInput
): Promise<BudgetResponse> => {
  // 1. Fetch existing
  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
    include: budgetInclude,
  });

  if (!existing) {
    throw new AppError("Budget not found", 404);
  }

  // 2. Compute the final merged state
  const nextType = (input.type ?? existing.type) as BudgetType;
  const nextPeriod = (input.period ?? existing.period) as BudgetPeriod;
  const nextStartDate =
    input.startDate !== undefined
      ? toStartOfDayUTC(input.startDate)
      : existing.startDate;
  const nextEndDate =
    input.endDate !== undefined
      ? toEndOfDayUTC(input.endDate)
      : existing.endDate;

  // When switching type:
  // CATEGORY → OVERALL: force categoryId = null
  // OVERALL → CATEGORY: input must provide categoryId
  let nextCategoryId: string | null;
  if ("categoryId" in input) {
    nextCategoryId = input.categoryId ?? null;
  } else {
    // Not provided in patch — inherit from existing, but clear if switching to OVERALL
    nextCategoryId =
      nextType === "OVERALL" ? null : (existing.categoryId ?? null);
  }

  // 3. Cross-field validation on merged state
  validateMergedBudgetFields({
    type: nextType,
    period: nextPeriod,
    categoryId: nextCategoryId,
    startDate: nextStartDate.toISOString(),
    endDate: nextEndDate.toISOString(),
  });

  // 4. Category ownership / type check
  if (nextType === "CATEGORY" && nextCategoryId) {
    const category = await prisma.category.findFirst({
      where: { id: nextCategoryId, userId },
    });

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (category.type !== CategoryType.EXPENSE) {
      throw new AppError(
        "Budgets can only be created for expense categories",
        400
      );
    }
  }

  // 5. Overlap check (exclude current budget)
  await checkOverlap(
    userId,
    nextType,
    nextStartDate,
    nextEndDate,
    nextCategoryId,
    budgetId
  );

  // 6. Persist
  const updated = await prisma.budget.update({
    where: { id: budgetId },
    data: {
      amount: input.amount
        ? new Prisma.Decimal(input.amount)
        : undefined,
      type: nextType,
      period: nextPeriod,
      startDate: nextStartDate,
      endDate: nextEndDate,
      categoryId: nextCategoryId,
    },
    include: budgetInclude,
  });

  const spent = await calcSpent(userId, updated);
  return formatBudget(updated, spent);
};

// ---------------------------------------------------------------------------
// deleteBudget
// ---------------------------------------------------------------------------

export const deleteBudget = async (
  userId: string,
  budgetId: string
): Promise<void> => {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  });

  if (!budget) {
    throw new AppError("Budget not found", 404);
  }

  await prisma.budget.delete({ where: { id: budgetId } });
  // Transactions are NOT affected — they are financial history.
};
