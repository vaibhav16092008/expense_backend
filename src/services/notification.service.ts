import { Prisma, NotificationType, NotificationSeverity } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { getPaginationParams, buildPaginationMeta, PaginatedResult } from "../utils/pagination.js";
import { GetNotificationsQueryInput } from "../validators/notification.validator.js";
import { getBudgets } from "./budget.service.js";
import { aggregateUserTransactions } from "./report.service.js";

// ---------------------------------------------------------------------------
// Response Shapes
// ---------------------------------------------------------------------------

export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  isRead: boolean;
  referenceType: string | null;
  referenceId: string | null;
  notificationKey: string;
  createdAt: Date;
  readAt: Date | null;
}

// ---------------------------------------------------------------------------
// Helper: Idempotent Notification Creation (Catches Unique Constraint P2002)
// ---------------------------------------------------------------------------

export async function createNotificationIdempotent(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  referenceType?: string;
  referenceId?: string;
  notificationKey: string;
}): Promise<NotificationResponse | null> {
  const existing = await prisma.notification.findUnique({
    where: {
      userId_type_notificationKey: {
        userId: data.userId,
        type: data.type,
        notificationKey: data.notificationKey,
      },
    },
  });

  if (existing) {
    return null;
  }

  try {
    const created = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        severity: data.severity ?? "INFO",
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        notificationKey: data.notificationKey,
      },
    });
    return created;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Duplicate notification key race condition for (userId, type, notificationKey) — safely skip
      return null;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 1. GET Notifications (Paginated, Filtered)
// ---------------------------------------------------------------------------

export const getNotifications = async (
  userId: string,
  query: GetNotificationsQueryInput
): Promise<PaginatedResult<NotificationResponse>> => {
  const where: Prisma.NotificationWhereInput = { userId };

  if (query.unreadOnly) {
    where.isRead = false;
  }

  if (query.type) {
    where.type = query.type;
  }

  const { skip, take, page, limit } = getPaginationParams(query.page, query.limit);

  const [totalCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    data: notifications,
    pagination: buildPaginationMeta(page, limit, totalCount),
  };
};

// ---------------------------------------------------------------------------
// 2. GET Unread Count
// ---------------------------------------------------------------------------

export const getUnreadNotificationCount = async (userId: string): Promise<{ count: number }> => {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { count };
};

// ---------------------------------------------------------------------------
// 3. Mark Single Notification as Read
// ---------------------------------------------------------------------------

export const markNotificationAsRead = async (
  userId: string,
  notificationId: string
): Promise<NotificationResponse> => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!existing) {
    throw new AppError("Notification not found", 404);
  }

  if (existing.isRead) {
    return existing;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

// ---------------------------------------------------------------------------
// 4. Mark All Notifications as Read (Bulk Update)
// ---------------------------------------------------------------------------

export const markAllNotificationsAsRead = async (
  userId: string
): Promise<{ count: number }> => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { count: result.count };
};

// ---------------------------------------------------------------------------
// 5. Delete Notification
// ---------------------------------------------------------------------------

export const deleteNotification = async (
  userId: string,
  notificationId: string
): Promise<void> => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!existing) {
    throw new AppError("Notification not found", 404);
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });
};

// ---------------------------------------------------------------------------
// 6. Notification Event Generators
// ---------------------------------------------------------------------------

/**
 * Generate Budget Alerts (70%+ WARNING, 90%+ CRITICAL, 100%+ EXCEEDED)
 */
export async function generateBudgetNotifications(): Promise<number> {
  let createdCount = 0;

  // Find user IDs with active budgets whose settings permit budget alerts
  const budgetUserIds = await prisma.budget.findMany({
    where: {
      user: {
        OR: [
          { settings: null },
          { settings: { budgetAlertsEnabled: true } },
        ],
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of budgetUserIds) {
    const budgets = await getBudgets(userId, {});

    for (const b of budgets) {
      const startStr = new Date(b.startDate).toISOString().split("T")[0];
      const endStr = new Date(b.endDate).toISOString().split("T")[0];
      const periodKey = `${startStr}_${endStr}`;
      const name = b.category ? b.category.name : "Overall Budget";

      let type: NotificationType | null = null;
      let severity: NotificationSeverity = "INFO";
      let statusKey = "";
      let title = "";
      let message = "";

      if (b.percentage >= 100) {
        type = "BUDGET_EXCEEDED";
        severity = "CRITICAL";
        statusKey = "exceeded";
        title = "Budget Exceeded";
        message = `${name} has exceeded its allocated limit (${b.percentage}% used).`;
      } else if (b.percentage >= 90) {
        type = "BUDGET_CRITICAL";
        severity = "CRITICAL";
        statusKey = "critical";
        title = "Budget Limit Critical";
        message = `${name} is at critical limit (${b.percentage}% used).`;
      } else if (b.percentage >= 70) {
        type = "BUDGET_WARNING";
        severity = "WARNING";
        statusKey = "warning";
        title = "Budget Warning";
        message = `${name} has reached ${b.percentage}% of its allocated limit.`;
      }

      if (type) {
        const created = await createNotificationIdempotent({
          userId,
          type,
          title,
          message,
          severity,
          referenceType: "BUDGET",
          referenceId: b.id,
          notificationKey: `budget:${b.id}:${statusKey}:${periodKey}`,
        });
        if (created) createdCount++;
      }
    }
  }

  return createdCount;
}

/**
 * Generate Recurring Transaction Notifications (Upcoming within 24h & Due)
 */
export async function generateRecurringNotifications(): Promise<number> {
  let createdCount = 0;
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const schedules = await prisma.recurringTransaction.findMany({
    where: {
      active: true,
      user: {
        OR: [
          { settings: null },
          { settings: { recurringRemindersEnabled: true } },
        ],
      },
    },
    include: {
      category: { select: { name: true } },
    },
  });

  for (const schedule of schedules) {
    const nextRun = schedule.nextRunAt;
    const dateKey = nextRun.toISOString().split("T")[0];
    const categoryName = schedule.category.name;
    const amountStr = schedule.amount.toFixed(2);

    if (nextRun <= now) {
      const created = await createNotificationIdempotent({
        userId: schedule.userId,
        type: "RECURRING_DUE",
        title: "Recurring Payment Due",
        message: `${categoryName} recurring transaction of ${amountStr} is due.`,
        severity: "WARNING",
        referenceType: "RECURRING_TRANSACTION",
        referenceId: schedule.id,
        notificationKey: `recurring:${schedule.id}:due:${dateKey}`,
      });
      if (created) createdCount++;
    } else if (nextRun <= in24h) {
      const created = await createNotificationIdempotent({
        userId: schedule.userId,
        type: "RECURRING_UPCOMING",
        title: "Upcoming Recurring Payment",
        message: `${categoryName} recurring transaction of ${amountStr} is scheduled within 24 hours.`,
        severity: "INFO",
        referenceType: "RECURRING_TRANSACTION",
        referenceId: schedule.id,
        notificationKey: `recurring:${schedule.id}:upcoming:${dateKey}`,
      });
      if (created) createdCount++;
    }
  }

  return createdCount;
}

/**
 * Generate Goal Notifications (Milestones 50%, 75%, 90%, 100% & Deadline within 7 days)
 */
export async function generateGoalNotifications(): Promise<number> {
  let createdCount = 0;
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const goals = await prisma.financialGoal.findMany({
    where: {
      status: "ACTIVE",
      user: {
        OR: [
          { settings: null },
          { settings: { goalRemindersEnabled: true } },
        ],
      },
    },
  });

  for (const goal of goals) {
    const target = goal.targetAmount.toNumber();
    const current = goal.currentAmount.toNumber();
    const pct = target > 0 ? Math.round((current / target) * 100) : 0;

    // 1. Progress Milestones
    const milestones = [50, 75, 90, 100];
    for (const milestone of milestones) {
      if (pct >= milestone) {
        const created = await createNotificationIdempotent({
          userId: goal.userId,
          type: "GOAL_PROGRESS",
          title: "Goal Progress Milestone",
          message: `${goal.name} has reached ${milestone}% of its target (${pct}% achieved).`,
          severity: milestone === 100 ? "INFO" : "INFO",
          referenceType: "FINANCIAL_GOAL",
          referenceId: goal.id,
          notificationKey: `goal:${goal.id}:progress:${milestone}`,
        });
        if (created) createdCount++;
      }
    }

    // 2. Deadline Reminder (if incomplete and deadline within 7 days)
    if (goal.deadline && current < target && goal.deadline >= now && goal.deadline <= in7Days) {
      const deadlineKey = goal.deadline.toISOString().split("T")[0];
      const created = await createNotificationIdempotent({
        userId: goal.userId,
        type: "GOAL_DEADLINE",
        title: "Goal Deadline Approaching",
        message: `${goal.name} deadline is approaching on ${deadlineKey}.`,
        severity: "WARNING",
        referenceType: "FINANCIAL_GOAL",
        referenceId: goal.id,
        notificationKey: `goal:${goal.id}:deadline:${deadlineKey}`,
      });
      if (created) createdCount++;
    }
  }

  return createdCount;
}

/**
 * Generate Monthly Summary Notifications for Previous Calendar Month
 */
export async function generateMonthlySummaryNotifications(): Promise<number> {
  let createdCount = 0;
  const now = new Date();

  // Calculate previous calendar month start and end
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const lastDayPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
  const prevMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, lastDayPrevMonth, 23, 59, 59, 999));

  const periodKey = prevMonthStart.toISOString().slice(0, 7); // YYYY-MM
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = `${monthNames[prevMonthStart.getUTCMonth()]} ${prevMonthStart.getUTCFullYear()}`;

  const disabledUsers = await prisma.userSettings.findMany({
    where: { monthlySummaryEnabled: false },
    select: { userId: true },
  });
  const disabledSet = new Set(disabledUsers.map((u) => u.userId));

  const users = await prisma.user.findMany({
    where: { id: { notIn: Array.from(disabledSet) } },
    select: { id: true },
  });

  for (const { id: userId } of users) {
    const agg = await aggregateUserTransactions(userId, prevMonthStart, prevMonthEnd);

    const created = await createNotificationIdempotent({
      userId,
      type: "MONTHLY_SUMMARY",
      title: `${monthLabel} Financial Summary`,
      message: `Income: ${agg.totalIncome}, Expense: ${agg.totalExpense}, Savings: ${agg.savings} (${agg.savingsRate}% savings rate).`,
      severity: "INFO",
      referenceType: "MONTHLY_SUMMARY",
      referenceId: periodKey,
      notificationKey: `monthly-summary:${periodKey}`,
    });
    if (created) createdCount++;
  }

  return createdCount;
}

/**
 * Orchestrate generation of all notification types
 */
export async function generateAllNotifications(): Promise<void> {
  try {
    await generateBudgetNotifications();
    await generateRecurringNotifications();
    await generateGoalNotifications();
    await generateMonthlySummaryNotifications();
  } catch (error) {
    console.error("[NOTIFICATION_GEN] Error generating notifications:", error);
  }
}
