import { Prisma, GoalStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import {
  CreateGoalInput,
  UpdateGoalInput,
  ContributionInput,
  GoalQueryInput,
} from "../validators/goal.validator.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetAmount: Prisma.Decimal;
  currentAmount: Prisma.Decimal;
  deadline: Date | null;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type DerivedStatus =
  | "PAUSED"
  | "COMPLETED"
  | "NOT_STARTED"
  | "OVERDUE"
  | "AT_RISK"
  | "ON_TRACK";

export interface DerivedFields {
  remainingAmount: string;
  progressPercentage: number;
  daysRemaining: number | null;
  derivedStatus: DerivedStatus;
}

export type GoalWithDerived = GoalRow & DerivedFields;

// ---------------------------------------------------------------------------
// Helper: derived calculations (pure function — no DB access)
// ---------------------------------------------------------------------------

export function calcDerived(goal: GoalRow): DerivedFields {
  const target = goal.targetAmount;
  const current = goal.currentAmount;

  // remainingAmount = max(target - current, 0)
  const rawRemaining = target.minus(current);
  const remainingDecimal = rawRemaining.isNegative()
    ? new Prisma.Decimal(0)
    : rawRemaining;
  const remainingAmount = remainingDecimal.toFixed(2);

  // progressPercentage = min((current / target) * 100, 100)
  let progressPercentage = 0;
  if (!target.isZero()) {
    const raw = current.dividedBy(target).times(100);
    const capped = Prisma.Decimal.min(raw, new Prisma.Decimal(100));
    progressPercentage = parseFloat(capped.toFixed(2));
  }

  // daysRemaining — whole calendar days using UTC boundaries
  let daysRemaining: number | null = null;
  if (goal.deadline) {
    const nowUtcMidnight = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    );
    const deadlineUtcMidnight = Date.UTC(
      goal.deadline.getUTCFullYear(),
      goal.deadline.getUTCMonth(),
      goal.deadline.getUTCDate()
    );
    daysRemaining = Math.round(
      (deadlineUtcMidnight - nowUtcMidnight) / (1000 * 60 * 60 * 24)
    );
  }

  // derivedStatus — deterministic precedence order
  let derivedStatus: DerivedStatus;

  if (goal.status === "PAUSED") {
    derivedStatus = "PAUSED";
  } else if (goal.status === "COMPLETED" || current.greaterThanOrEqualTo(target)) {
    derivedStatus = "COMPLETED";
  } else if (current.isZero()) {
    derivedStatus = "NOT_STARTED";
  } else if (goal.deadline && daysRemaining !== null && daysRemaining < 0) {
    // deadline has passed and target not reached
    derivedStatus = "OVERDUE";
  } else if (goal.deadline && daysRemaining !== null && daysRemaining >= 0) {
    // Check AT_RISK: compare expected progress vs actual progress
    // Expected progress at this point (linear from createdAt to deadline)
    const totalDays = Math.round(
      (goal.deadline.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const elapsedDays = totalDays - daysRemaining;
    if (totalDays > 0 && elapsedDays > 0) {
      const expectedProgress = (elapsedDays / totalDays) * 100;
      // AT_RISK: actual progress is more than 10% behind expected
      if (progressPercentage < expectedProgress - 10) {
        derivedStatus = "AT_RISK";
      } else {
        derivedStatus = "ON_TRACK";
      }
    } else {
      derivedStatus = "ON_TRACK";
    }
  } else {
    derivedStatus = "ON_TRACK";
  }

  return { remainingAmount, progressPercentage, daysRemaining, derivedStatus };
}

function enrichGoal(goal: GoalRow): GoalWithDerived {
  return { ...goal, ...calcDerived(goal) };
}

// ---------------------------------------------------------------------------
// Service functions — all scoped by userId
// ---------------------------------------------------------------------------

export const createGoal = async (
  userId: string,
  input: CreateGoalInput
): Promise<GoalWithDerived> => {
  const goal = await prisma.financialGoal.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      targetAmount: new Prisma.Decimal(input.targetAmount),
      currentAmount: new Prisma.Decimal(0),
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "ACTIVE",
      userId,
    },
  });
  return enrichGoal(goal);
};

export const listGoals = async (
  userId: string,
  query: GoalQueryInput
): Promise<GoalWithDerived[]> => {
  // Build where clause
  const where: Prisma.FinancialGoalWhereInput = { userId };

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.hasDeadline === true) {
    where.deadline = { not: null };
  } else if (query.hasDeadline === false) {
    where.deadline = null;
  }

  // Build orderBy
  type SortField = "createdAt" | "deadline" | "targetAmount" | "currentAmount" | "name";
  const sortField: SortField = (query.sortBy as SortField) ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const goals = await prisma.financialGoal.findMany({
    where,
    orderBy: { [sortField]: sortOrder },
  });

  return goals.map(enrichGoal);
};

export const getGoal = async (
  userId: string,
  goalId: string
): Promise<GoalWithDerived> => {
  const goal = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) {
    throw new AppError("Goal not found", 404);
  }

  return enrichGoal(goal);
};

export const updateGoal = async (
  userId: string,
  goalId: string,
  input: UpdateGoalInput
): Promise<GoalWithDerived> => {
  const existing = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!existing) {
    throw new AppError("Goal not found", 404);
  }

  const updateData: Prisma.FinancialGoalUpdateInput = {};

  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if ("description" in input) {
    updateData.description = input.description?.trim() ?? null;
  }
  if (input.targetAmount !== undefined) {
    updateData.targetAmount = new Prisma.Decimal(input.targetAmount);
  }
  if ("deadline" in input) {
    updateData.deadline = input.deadline ? new Date(input.deadline) : null;
  }

  // Determine if new targetAmount causes auto-completion
  const newTargetAmount =
    input.targetAmount !== undefined
      ? new Prisma.Decimal(input.targetAmount)
      : existing.targetAmount;

  if (
    existing.status === "ACTIVE" &&
    existing.currentAmount.greaterThanOrEqualTo(newTargetAmount)
  ) {
    updateData.status = "COMPLETED";
  }

  const updated = await prisma.financialGoal.update({
    where: { id: goalId },
    data: updateData,
  });

  return enrichGoal(updated);
};

export const deleteGoal = async (
  userId: string,
  goalId: string
): Promise<void> => {
  const existing = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!existing) {
    throw new AppError("Goal not found", 404);
  }

  // Delete the goal — contributions cascade via schema
  await prisma.financialGoal.delete({ where: { id: goalId } });
};

// ---------------------------------------------------------------------------
// Contribution operations (atomic transactions)
// ---------------------------------------------------------------------------

export const addContribution = async (
  userId: string,
  goalId: string,
  input: ContributionInput
): Promise<{ contribution: object; goal: GoalWithDerived }> => {
  return await prisma.$transaction(async (tx) => {
    // Verify goal exists and belongs to user
    const goal = await tx.financialGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new AppError("Goal not found", 404);
    }

    if (goal.status === "PAUSED") {
      throw new AppError(
        "Cannot add a contribution to a paused goal",
        400
      );
    }

    if (goal.status === "COMPLETED") {
      throw new AppError(
        "Cannot add a contribution to a completed goal",
        400
      );
    }

    // Create the contribution
    const contribution = await tx.goalContribution.create({
      data: {
        amount: new Prisma.Decimal(input.amount),
        note: input.note?.trim() ?? null,
        type: input.type ?? "MANUAL",
        goalId,
        userId,
      },
    });

    // Atomically increment currentAmount
    const updatedGoal = await tx.financialGoal.update({
      where: { id: goalId },
      data: {
        currentAmount: { increment: new Prisma.Decimal(input.amount) },
      },
    });

    // Auto-complete if currentAmount >= targetAmount
    let finalGoal = updatedGoal;
    if (
      updatedGoal.status === "ACTIVE" &&
      updatedGoal.currentAmount.greaterThanOrEqualTo(updatedGoal.targetAmount)
    ) {
      finalGoal = await tx.financialGoal.update({
        where: { id: goalId },
        data: { status: "COMPLETED" },
      });
    }

    return { contribution, goal: enrichGoal(finalGoal) };
  });
};

export const deleteContribution = async (
  userId: string,
  goalId: string,
  contributionId: string
): Promise<GoalWithDerived> => {
  return await prisma.$transaction(async (tx) => {
    // Verify goal belongs to user
    const goal = await tx.financialGoal.findFirst({
      where: { id: goalId, userId },
    });

    if (!goal) {
      throw new AppError("Goal not found", 404);
    }

    // Verify contribution belongs to the goal and user
    const contribution = await tx.goalContribution.findFirst({
      where: { id: contributionId, goalId, userId },
    });

    if (!contribution) {
      throw new AppError("Contribution not found", 404);
    }

    // Delete contribution
    await tx.goalContribution.delete({ where: { id: contributionId } });

    // Atomically decrement — guard against going below zero
    const newAmount = Prisma.Decimal.max(
      goal.currentAmount.minus(contribution.amount),
      new Prisma.Decimal(0)
    );

    const updatedGoal = await tx.financialGoal.update({
      where: { id: goalId },
      data: { currentAmount: newAmount },
    });

    return enrichGoal(updatedGoal);
  });
};

export const listContributions = async (
  userId: string,
  goalId: string
): Promise<object[]> => {
  // Verify goal belongs to user first
  const goal = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) {
    throw new AppError("Goal not found", 404);
  }

  const contributions = await prisma.goalContribution.findMany({
    where: { goalId, userId },
    orderBy: { createdAt: "desc" },
  });

  return contributions;
};

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

export const pauseGoal = async (
  userId: string,
  goalId: string
): Promise<GoalWithDerived> => {
  const goal = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) {
    throw new AppError("Goal not found", 404);
  }

  if (goal.status === "COMPLETED") {
    throw new AppError("Cannot pause a completed goal", 400);
  }

  if (goal.status === "PAUSED") {
    throw new AppError("Goal is already paused", 400);
  }

  const updated = await prisma.financialGoal.update({
    where: { id: goalId },
    data: { status: "PAUSED" },
  });

  return enrichGoal(updated);
};

export const resumeGoal = async (
  userId: string,
  goalId: string
): Promise<GoalWithDerived> => {
  const goal = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) {
    throw new AppError("Goal not found", 404);
  }

  if (goal.status === "COMPLETED") {
    throw new AppError("Cannot resume a completed goal", 400);
  }

  if (goal.status !== "PAUSED") {
    throw new AppError("Goal is not paused", 400);
  }

  const updated = await prisma.financialGoal.update({
    where: { id: goalId },
    data: { status: "ACTIVE" },
  });

  return enrichGoal(updated);
};

export const completeGoal = async (
  userId: string,
  goalId: string
): Promise<GoalWithDerived> => {
  const goal = await prisma.financialGoal.findFirst({
    where: { id: goalId, userId },
  });

  if (!goal) {
    throw new AppError("Goal not found", 404);
  }

  if (goal.status === "COMPLETED") {
    throw new AppError("Goal is already completed", 400);
  }

  const updated = await prisma.financialGoal.update({
    where: { id: goalId },
    data: { status: "COMPLETED" },
  });

  return enrichGoal(updated);
};

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface GoalSummary {
  totalGoals: number;
  activeGoals: number;
  pausedGoals: number;
  completedGoals: number;
  overdueGoals: number;
  totalTargetAmount: string;
  totalCurrentAmount: string;
  totalRemainingAmount: string;
  overallProgressPercentage: number;
  nearestDeadline: Date | null;
  topGoal: {
    id: string;
    name: string;
    progressPercentage: number;
  } | null;
}

export const getGoalSummary = async (userId: string): Promise<GoalSummary> => {
  const goals = await prisma.financialGoal.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (goals.length === 0) {
    return {
      totalGoals: 0,
      activeGoals: 0,
      pausedGoals: 0,
      completedGoals: 0,
      overdueGoals: 0,
      totalTargetAmount: "0.00",
      totalCurrentAmount: "0.00",
      totalRemainingAmount: "0.00",
      overallProgressPercentage: 0,
      nearestDeadline: null,
      topGoal: null,
    };
  }

  const enriched = goals.map(enrichGoal);

  // Aggregate using Decimal arithmetic (no floating point errors)
  let totalTarget = new Prisma.Decimal(0);
  let totalCurrent = new Prisma.Decimal(0);

  for (const g of goals) {
    totalTarget = totalTarget.plus(g.targetAmount);
    totalCurrent = totalCurrent.plus(g.currentAmount);
  }

  const rawRemaining = totalTarget.minus(totalCurrent);
  const totalRemaining = rawRemaining.isNegative()
    ? new Prisma.Decimal(0)
    : rawRemaining;

  let overallProgressPercentage = 0;
  if (!totalTarget.isZero()) {
    const raw = totalCurrent.dividedBy(totalTarget).times(100);
    const capped = Prisma.Decimal.min(raw, new Prisma.Decimal(100));
    overallProgressPercentage = parseFloat(capped.toFixed(2));
  }

  // Count per status
  const activeGoals = enriched.filter((g) => g.status === "ACTIVE").length;
  const pausedGoals = enriched.filter((g) => g.status === "PAUSED").length;
  const completedGoals = enriched.filter((g) => g.status === "COMPLETED").length;
  // OVERDUE = derivedStatus is OVERDUE
  const overdueGoals = enriched.filter((g) => g.derivedStatus === "OVERDUE").length;

  // Nearest upcoming deadline
  const now = new Date();
  const futureDeadlines = goals
    .filter((g) => g.deadline && g.deadline > now)
    .map((g) => g.deadline as Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const nearestDeadline = futureDeadlines[0] ?? null;

  // Top goal: highest progressPercentage; tie-break by earliest createdAt
  const sorted = [...enriched].sort((a, b) => {
    if (b.progressPercentage !== a.progressPercentage) {
      return b.progressPercentage - a.progressPercentage;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const top = sorted[0];
  const topGoal = top
    ? {
        id: top.id,
        name: top.name,
        progressPercentage: top.progressPercentage,
      }
    : null;

  return {
    totalGoals: goals.length,
    activeGoals,
    pausedGoals,
    completedGoals,
    overdueGoals,
    totalTargetAmount: totalTarget.toFixed(2),
    totalCurrentAmount: totalCurrent.toFixed(2),
    totalRemainingAmount: totalRemaining.toFixed(2),
    overallProgressPercentage,
    nearestDeadline,
    topGoal,
  };
};
