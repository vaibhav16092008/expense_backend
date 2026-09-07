import { Writable } from "stream";
import { prisma } from "../config/prisma.js";
import { formatCsvRow } from "../utils/csv.js";
import { exportTransactionsStream } from "./transaction.service.js";
import {
  getFinancialSummaryReport,
  getCashFlowReport,
  getCategorySpendingReport,
  getBudgetPerformanceReport,
  getSavingsReport,
} from "./report.service.js";
import {
  ExportTransactionsQueryInput,
  ExportReportQueryInput,
} from "../validators/export.validator.js";
import { AppError } from "../middlewares/error.middleware.js";

// ---------------------------------------------------------------------------
// 1. Transaction CSV Export
// ---------------------------------------------------------------------------

export const exportTransactionsCsv = async (
  userId: string,
  filters: ExportTransactionsQueryInput,
  writable: Writable
): Promise<void> => {
  await exportTransactionsStream(
    userId,
    {
      startDate: filters.from,
      endDate: filters.to,
      type: filters.type,
      categoryId: filters.categoryId,
    },
    writable
  );
};

// ---------------------------------------------------------------------------
// 2. Report CSV Export
// ---------------------------------------------------------------------------

export const exportReportCsv = async (
  userId: string,
  input: ExportReportQueryInput
): Promise<string> => {
  const { type, from, to, groupBy } = input;

  switch (type) {
    case "summary": {
      const summary = await getFinancialSummaryReport(userId, { from, to });
      let csv = formatCsvRow(["Metric", "Value"]);
      csv += formatCsvRow(["Total Income", summary.totalIncome]);
      csv += formatCsvRow(["Total Expense", summary.totalExpense]);
      csv += formatCsvRow(["Savings", summary.savings]);
      csv += formatCsvRow(["Savings Rate", summary.savingsRate.toFixed(2)]);
      return csv;
    }

    case "cash-flow": {
      const cashFlow = await getCashFlowReport(userId, {
        from,
        to,
        groupBy: (groupBy as "day" | "week" | "month") || "month",
      });
      let csv = formatCsvRow(["Period", "Income", "Expense", "Net"]);
      for (const item of cashFlow.data) {
        csv += formatCsvRow([item.period, item.income, item.expense, item.net]);
      }
      return csv;
    }

    case "categories": {
      const categories = await getCategorySpendingReport(userId, { from, to });
      let csv = formatCsvRow(["Category", "Amount", "Percentage"]);
      for (const item of categories.data) {
        csv += formatCsvRow([
          item.categoryName,
          item.amount,
          item.percentage.toFixed(2),
        ]);
      }
      return csv;
    }

    case "budgets": {
      const budgets = await getBudgetPerformanceReport(userId, { from, to });
      let csv = formatCsvRow([
        "Budget",
        "Type",
        "Period",
        "Start Date",
        "End Date",
        "Amount",
        "Spent",
        "Remaining",
        "Percentage",
        "Status",
      ]);
      for (const b of budgets.budgets) {
        const startDateStr = new Date(b.startDate).toISOString().split("T")[0]!;
        const endDateStr = new Date(b.endDate).toISOString().split("T")[0]!;
        csv += formatCsvRow([
          b.name,
          b.type,
          b.period,
          startDateStr,
          endDateStr,
          b.amount,
          b.spent,
          b.remaining,
          b.percentageUsed.toFixed(2),
          b.status,
        ]);
      }
      return csv;
    }

    case "savings": {
      const savings = await getSavingsReport(userId, {
        from,
        to,
        groupBy: (groupBy as "day" | "week" | "month") || "month",
      });
      let csv = formatCsvRow(["Period", "Income", "Expense", "Savings", "Savings Rate"]);
      for (const item of savings.breakdown) {
        csv += formatCsvRow([
          item.period,
          item.income,
          item.expense,
          item.savings,
          savings.savingsRate.toFixed(2),
        ]);
      }
      return csv;
    }

    default:
      throw new AppError("Invalid report type", 400);
  }
};

// ---------------------------------------------------------------------------
// 3. Complete Financial JSON Export
// ---------------------------------------------------------------------------

export const exportFinancialDataJson = async (userId: string) => {
  const [
    profile,
    settings,
    categories,
    transactions,
    budgets,
    recurringTransactions,
    goals,
    goalContributions,
  ] = await Promise.all([
    // Profile — EXCLUDE password
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    // Settings
    prisma.userSettings.findUnique({
      where: { userId },
      select: {
        id: true,
        currency: true,
        monthlyBudgetEnabled: true,
        monthlyBudgetAmount: true,
        budgetAlertsEnabled: true,
        recurringRemindersEnabled: true,
        goalRemindersEnabled: true,
        theme: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    // Categories
    prisma.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    }),

    // Transactions
    prisma.transaction.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        type: true,
        note: true,
        date: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, type: true },
        },
        recurringTransactionId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),

    // Budgets
    prisma.budget.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        type: true,
        period: true,
        startDate: true,
        endDate: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, type: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { startDate: "desc" },
    }),

    // Recurring Transactions
    prisma.recurringTransaction.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        type: true,
        note: true,
        frequency: true,
        startDate: true,
        nextRunAt: true,
        endDate: true,
        active: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, type: true },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    // Financial Goals
    prisma.financialGoal.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        targetAmount: true,
        currentAmount: true,
        deadline: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),

    // Goal Contributions
    prisma.goalContribution.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        note: true,
        type: true,
        goalId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!profile) {
    throw new AppError("User profile not found", 404);
  }

  return {
    metadata: {
      application: "ExpenseIQ",
      version: "1",
      exportedAt: new Date().toISOString(),
    },
    profile,
    settings: settings || null,
    categories,
    transactions: transactions.map((tx) => ({
      ...tx,
      amount: tx.amount.toFixed(2),
    })),
    budgets: budgets.map((b) => ({
      ...b,
      amount: b.amount.toFixed(2),
    })),
    recurringTransactions: recurringTransactions.map((rt) => ({
      ...rt,
      amount: rt.amount.toFixed(2),
    })),
    goals: goals.map((g) => ({
      ...g,
      targetAmount: g.targetAmount.toFixed(2),
      currentAmount: g.currentAmount.toFixed(2),
    })),
    goalContributions: goalContributions.map((gc) => ({
      ...gc,
      amount: gc.amount.toFixed(2),
    })),
  };
};
