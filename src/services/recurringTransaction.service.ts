import {
  Prisma,
  RecurringFrequency,
  TransactionType,
  CategoryType,
} from "@prisma/client";
import { prisma } from "../config/prisma.js";
import {
  CreateRecurringTransactionInput,
  UpdateRecurringTransactionInput,
  RecurringTransactionQueryInput,
} from "../validators/recurringTransaction.validator.js";
import { AppError } from "../middlewares/error.middleware.js";

// ---------------------------------------------------------------------------
// Response Shape
// ---------------------------------------------------------------------------

export interface RecurringTransactionResponse {
  id: string;
  amount: string;
  type: TransactionType;
  frequency: RecurringFrequency;
  note: string | null;
  startDate: Date;
  nextRunAt: Date;
  endDate: Date | null;
  active: boolean;
  category: {
    id: string;
    name: string;
    type: CategoryType;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessSummaryResponse {
  processedSchedules: number;
  generatedTransactions: number;
  skippedDuplicates: number;
  deactivatedSchedules: number;
}

// ---------------------------------------------------------------------------
// Date Helpers
// ---------------------------------------------------------------------------

function toStartOfDayUTC(dateStr: string | Date): Date {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
}

function toEndOfDayUTC(dateStr: string | Date): Date {
  const d = new Date(dateStr);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Calculates the next occurrence while strictly preserving anchor day-of-month
 * and handling month-end / leap-year edge cases without date overflow.
 */
export function calculateNextOccurrence(
  currentDate: Date,
  frequency: RecurringFrequency,
  anchorDay: number,
  anchorMonth?: number
): Date {
  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth();
  const day = currentDate.getUTCDate();

  switch (frequency) {
    case "DAILY": {
      return new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
    }

    case "WEEKLY": {
      return new Date(Date.UTC(year, month, day + 7, 0, 0, 0, 0));
    }

    case "MONTHLY": {
      const nextMonthRaw = month + 1;
      const nextYear = year + Math.floor(nextMonthRaw / 12);
      const nextMonth = nextMonthRaw % 12;

      const maxDays = lastDayOfMonth(nextYear, nextMonth);
      const targetDay = Math.min(anchorDay, maxDays);

      return new Date(Date.UTC(nextYear, nextMonth, targetDay, 0, 0, 0, 0));
    }

    case "YEARLY": {
      const nextYear = year + 1;
      const targetMonth = anchorMonth !== undefined ? anchorMonth : month;
      const maxDays = lastDayOfMonth(nextYear, targetMonth);
      const targetDay = Math.min(anchorDay, maxDays);

      return new Date(
        Date.UTC(nextYear, targetMonth, targetDay, 0, 0, 0, 0)
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Format Helper
// ---------------------------------------------------------------------------

const recurringInclude = {
  category: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
} satisfies Prisma.RecurringTransactionInclude;

function formatRecurring(recurring: {
  id: string;
  amount: Prisma.Decimal;
  type: TransactionType;
  frequency: RecurringFrequency;
  note: string | null;
  startDate: Date;
  nextRunAt: Date;
  endDate: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    type: CategoryType;
  };
}): RecurringTransactionResponse {
  return {
    id: recurring.id,
    amount: recurring.amount.toFixed(2),
    type: recurring.type,
    frequency: recurring.frequency,
    note: recurring.note,
    startDate: recurring.startDate,
    nextRunAt: recurring.nextRunAt,
    endDate: recurring.endDate,
    active: recurring.active,
    category: recurring.category,
    createdAt: recurring.createdAt,
    updatedAt: recurring.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// 1. Create Recurring Transaction
// ---------------------------------------------------------------------------

export const createRecurringTransaction = async (
  userId: string,
  input: CreateRecurringTransactionInput
): Promise<RecurringTransactionResponse> => {
  // 1. Validate Category ownership
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId },
  });

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  // 2. Validate Type consistency
  if (category.type !== (input.type as unknown as CategoryType)) {
    throw new AppError(
      "Recurring transaction type does not match category type",
      400
    );
  }

  const startDate = toStartOfDayUTC(input.startDate);
  const endDate = input.endDate ? toEndOfDayUTC(input.endDate) : null;

  // Server sets nextRunAt = startDate (does NOT generate historical txns on creation)
  const recurring = await prisma.recurringTransaction.create({
    data: {
      amount: new Prisma.Decimal(input.amount),
      type: input.type as TransactionType,
      frequency: input.frequency as RecurringFrequency,
      note: input.note ? input.note.trim() : null,
      startDate,
      nextRunAt: startDate,
      endDate,
      active: true,
      userId,
      categoryId: input.categoryId,
    },
    include: recurringInclude,
  });

  return formatRecurring(recurring);
};

// ---------------------------------------------------------------------------
// 2. Get Recurring Transactions (List & Filters)
// ---------------------------------------------------------------------------

export const getRecurringTransactions = async (
  userId: string,
  filters: RecurringTransactionQueryInput
): Promise<RecurringTransactionResponse[]> => {
  const where: Prisma.RecurringTransactionWhereInput = { userId };

  if (filters.active !== undefined) {
    where.active = filters.active;
  }

  if (filters.type) {
    where.type = filters.type as TransactionType;
  }

  if (filters.frequency) {
    where.frequency = filters.frequency as RecurringFrequency;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.startDate || filters.endDate) {
    where.startDate = {};
    if (filters.startDate) {
      where.startDate.gte = toStartOfDayUTC(filters.startDate);
    }
    if (filters.endDate) {
      where.startDate.lte = toEndOfDayUTC(filters.endDate);
    }
  }

  const sortBy = filters.sortBy || "nextRunAt";
  const sortOrder = filters.sortOrder || "asc";

  const list = await prisma.recurringTransaction.findMany({
    where,
    include: recurringInclude,
    orderBy: { [sortBy]: sortOrder },
  });

  return list.map(formatRecurring);
};

// ---------------------------------------------------------------------------
// 3. Get Single Recurring Transaction by ID
// ---------------------------------------------------------------------------

export const getRecurringTransactionById = async (
  userId: string,
  id: string
): Promise<RecurringTransactionResponse> => {
  const recurring = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
    include: recurringInclude,
  });

  if (!recurring) {
    throw new AppError("Recurring transaction not found", 404);
  }

  return formatRecurring(recurring);
};

// ---------------------------------------------------------------------------
// 4. Update Recurring Transaction
// ---------------------------------------------------------------------------

export const updateRecurringTransaction = async (
  userId: string,
  id: string,
  input: UpdateRecurringTransactionInput
): Promise<RecurringTransactionResponse> => {
  const existing = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
    include: recurringInclude,
  });

  if (!existing) {
    throw new AppError("Recurring transaction not found", 404);
  }

  const targetCategoryId = input.categoryId ?? existing.categoryId;
  const targetType = (input.type as TransactionType) ?? existing.type;

  // Validate Category & Type if changed
  if (input.categoryId || input.type) {
    const category = await prisma.category.findFirst({
      where: { id: targetCategoryId, userId },
    });

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (category.type !== (targetType as unknown as CategoryType)) {
      throw new AppError(
        "Recurring transaction type does not match category type",
        400
      );
    }
  }

  const nextStartDate = input.startDate
    ? toStartOfDayUTC(input.startDate)
    : existing.startDate;
  const nextEndDate =
    input.endDate !== undefined
      ? input.endDate
        ? toEndOfDayUTC(input.endDate)
        : null
      : existing.endDate;

  // Recalculate nextRunAt if startDate or frequency changed
  let nextRunAt = existing.nextRunAt;
  if (input.startDate) {
    nextRunAt = nextStartDate;
  }

  let nextActive = input.active !== undefined ? input.active : existing.active;
  if (nextEndDate && nextRunAt > nextEndDate) {
    nextActive = false;
  }

  const updated = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
      type: targetType,
      categoryId: targetCategoryId,
      note:
        input.note !== undefined
          ? input.note
            ? input.note.trim()
            : null
          : undefined,
      frequency: (input.frequency as RecurringFrequency) ?? undefined,
      startDate: nextStartDate,
      nextRunAt,
      endDate: nextEndDate,
      active: nextActive,
    },
    include: recurringInclude,
  });

  return formatRecurring(updated);
};

// ---------------------------------------------------------------------------
// 5. Delete Recurring Transaction
// ---------------------------------------------------------------------------

export const deleteRecurringTransaction = async (
  userId: string,
  id: string
): Promise<void> => {
  const recurring = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
  });

  if (!recurring) {
    throw new AppError("Recurring transaction not found", 404);
  }

  // Deleting recurring schedule does NOT delete generated transactions
  await prisma.recurringTransaction.delete({
    where: { id },
  });
};

// ---------------------------------------------------------------------------
// 6. Pause Recurring Transaction
// ---------------------------------------------------------------------------

export const pauseRecurringTransaction = async (
  userId: string,
  id: string
): Promise<RecurringTransactionResponse> => {
  const recurring = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
  });

  if (!recurring) {
    throw new AppError("Recurring transaction not found", 404);
  }

  const updated = await prisma.recurringTransaction.update({
    where: { id },
    data: { active: false },
    include: recurringInclude,
  });

  return formatRecurring(updated);
};

// ---------------------------------------------------------------------------
// 7. Resume Recurring Transaction
// ---------------------------------------------------------------------------

export const resumeRecurringTransaction = async (
  userId: string,
  id: string
): Promise<RecurringTransactionResponse> => {
  const recurring = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
  });

  if (!recurring) {
    throw new AppError("Recurring transaction not found", 404);
  }

  const now = new Date();
  const anchorDay = recurring.startDate.getUTCDate();
  const anchorMonth = recurring.startDate.getUTCMonth();

  let nextRunAt = recurring.nextRunAt;
  // If nextRunAt is in the past, advance until >= startOfToday (or next future occurrence)
  const startOfToday = toStartOfDayUTC(now);
  while (nextRunAt < startOfToday) {
    const nextOcc = calculateNextOccurrence(
      nextRunAt,
      recurring.frequency,
      anchorDay,
      anchorMonth
    );
    if (recurring.endDate && nextOcc > recurring.endDate) {
      break;
    }
    nextRunAt = nextOcc;
  }

  let active = true;
  if (recurring.endDate && nextRunAt > recurring.endDate) {
    active = false;
  }

  const updated = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      active,
      nextRunAt,
    },
    include: recurringInclude,
  });

  return formatRecurring(updated);
};

// ---------------------------------------------------------------------------
// 8. Process Due Recurring Transactions (Atomic, Idempotent, Scoped)
// ---------------------------------------------------------------------------

export const processDueRecurringTransactions = async (
  userId?: string
): Promise<ProcessSummaryResponse> => {
  const now = new Date();

  // Find all active schedules due for processing
  const where: Prisma.RecurringTransactionWhereInput = {
    active: true,
    nextRunAt: { lte: now },
  };

  if (userId) {
    where.userId = userId;
  }

  const dueSchedules = await prisma.recurringTransaction.findMany({
    where,
    orderBy: { nextRunAt: "asc" },
  });

  let processedSchedules = 0;
  let generatedTransactions = 0;
  let skippedDuplicates = 0;
  let deactivatedSchedules = 0;

  for (const schedule of dueSchedules) {
    let scheduleProcessed = false;
    const anchorDay = schedule.startDate.getUTCDate();
    const anchorMonth = schedule.startDate.getUTCMonth();

    let currentNextRunAt = schedule.nextRunAt;
    let currentActive = schedule.active;

    // Process all missed occurrences up to `now`
    while (currentNextRunAt <= now && currentActive) {
      const occurrenceDate = new Date(currentNextRunAt);

      // Verify not past endDate
      if (schedule.endDate && occurrenceDate > schedule.endDate) {
        currentActive = false;
        deactivatedSchedules++;
        break;
      }

      // Atomic processing per occurrence
      try {
        await prisma.$transaction(async (tx) => {
          // Check for existing occurrence using DB uniqueness guarantee
          const existing = await tx.transaction.findUnique({
            where: {
              recurringTransactionId_recurringOccurrenceAt: {
                recurringTransactionId: schedule.id,
                recurringOccurrenceAt: occurrenceDate,
              },
            },
          });

          if (!existing) {
            await tx.transaction.create({
              data: {
                amount: schedule.amount,
                type: schedule.type,
                categoryId: schedule.categoryId,
                note: schedule.note,
                date: occurrenceDate,
                userId: schedule.userId,
                recurringTransactionId: schedule.id,
                recurringOccurrenceAt: occurrenceDate,
              },
            });
            generatedTransactions++;
          } else {
            skippedDuplicates++;
          }
        });
      } catch (err: unknown) {
        // Unique constraint violation handled idempotently
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          skippedDuplicates++;
        } else {
          throw err;
        }
      }

      scheduleProcessed = true;

      // Advance nextRunAt
      const nextOcc = calculateNextOccurrence(
        occurrenceDate,
        schedule.frequency,
        anchorDay,
        anchorMonth
      );

      if (schedule.endDate && nextOcc > schedule.endDate) {
        currentActive = false;
        deactivatedSchedules++;
        currentNextRunAt = nextOcc;
        break;
      } else {
        currentNextRunAt = nextOcc;
      }
    }

    // Persist advanced nextRunAt & active status for schedule
    await prisma.recurringTransaction.update({
      where: { id: schedule.id },
      data: {
        nextRunAt: currentNextRunAt,
        active: currentActive,
      },
    });

    if (scheduleProcessed) {
      processedSchedules++;
    }
  }

  return {
    processedSchedules,
    generatedTransactions,
    skippedDuplicates,
    deactivatedSchedules,
  };
};
