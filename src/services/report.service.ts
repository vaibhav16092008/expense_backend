import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import {
  ReportDateRangeInput,
  CashFlowQueryInput,
  CustomReportQueryInput,
} from "../validators/report.validator.js";
import { getBudgets, BudgetResponse } from "./budget.service.js";

// ---------------------------------------------------------------------------
// Date Helpers
// ---------------------------------------------------------------------------

export function parseStartOfDayUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0));
}

export function parseEndOfDayUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999));
}

/**
 * Returns UTC Date set to 00:00:00.000 of the Monday for any given UTC date (ISO-8601 week start).
 */
export function getISOWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));
}

// ---------------------------------------------------------------------------
// Shared Transaction Aggregation Helper
// ---------------------------------------------------------------------------

interface IncomeExpenseAgg {
  totalIncome: string;
  totalExpense: string;
  savings: string;
  savingsRate: number;
  incomeNum: number;
  expenseNum: number;
  savingsNum: number;
}

export async function aggregateUserTransactions(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<IncomeExpenseAgg> {
  const groups = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amount: true,
    },
  });

  let income = 0;
  let expense = 0;

  for (const g of groups) {
    const sum = g._sum.amount ? g._sum.amount.toNumber() : 0;
    if (g.type === "INCOME") {
      income = sum;
    } else if (g.type === "EXPENSE") {
      expense = sum;
    }
  }

  const savingsNum = income - expense;
  const savingsRate =
    income > 0 ? Math.round(((income - expense) / income) * 100 * 100) / 100 : 0;

  return {
    totalIncome: income.toFixed(2),
    totalExpense: expense.toFixed(2),
    savings: savingsNum.toFixed(2),
    savingsRate,
    incomeNum: income,
    expenseNum: expense,
    savingsNum,
  };
}

// ---------------------------------------------------------------------------
// 1. GET /api/reports/summary
// ---------------------------------------------------------------------------

export const getFinancialSummaryReport = async (
  userId: string,
  input: ReportDateRangeInput
) => {
  const startDate = parseStartOfDayUTC(input.from);
  const endDate = parseEndOfDayUTC(input.to);

  const agg = await aggregateUserTransactions(userId, startDate, endDate);

  return {
    dateRange: {
      from: input.from,
      to: input.to,
    },
    totalIncome: agg.totalIncome,
    totalExpense: agg.totalExpense,
    savings: agg.savings,
    savingsRate: agg.savingsRate,
  };
};

// ---------------------------------------------------------------------------
// 2. GET /api/reports/cash-flow
// ---------------------------------------------------------------------------

export interface CashFlowPeriodItem {
  period: string;
  income: string;
  expense: string;
  net: string;
}

export const getCashFlowReport = async (
  userId: string,
  input: CashFlowQueryInput
): Promise<{ dateRange: { from: string; to: string }; groupBy: string; data: CashFlowPeriodItem[] }> => {
  const startDate = parseStartOfDayUTC(input.from);
  const endDate = parseEndOfDayUTC(input.to);
  const groupBy = input.groupBy || "month";

  // Pre-populate time buckets
  const buckets = new Map<string, { income: number; expense: number }>();

  if (groupBy === "day") {
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const key = curr.toISOString().split("T")[0]!;
      buckets.set(key, { income: 0, expense: 0 });
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
  } else if (groupBy === "week") {
    let currMonday = getISOWeekMonday(startDate);
    const endMonday = getISOWeekMonday(endDate);
    while (currMonday <= endMonday) {
      const key = `Week of ${currMonday.toISOString().split("T")[0]}`;
      buckets.set(key, { income: 0, expense: 0 });
      currMonday.setUTCDate(currMonday.getUTCDate() + 7);
    }
  } else {
    // month
    const startYear = startDate.getUTCFullYear();
    const startMonth = startDate.getUTCMonth();
    const endYear = endDate.getUTCFullYear();
    const endMonth = endDate.getUTCMonth();

    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const monthStr = (m + 1).toString().padStart(2, "0");
      const key = `${y}-${monthStr}`;
      buckets.set(key, { income: 0, expense: 0 });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }

  // Fetch only necessary fields
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      amount: true,
      type: true,
      date: true,
    },
    orderBy: { date: "asc" },
  });

  for (const tx of transactions) {
    let key = "";
    if (groupBy === "day") {
      key = tx.date.toISOString().split("T")[0]!;
    } else if (groupBy === "week") {
      const mon = getISOWeekMonday(tx.date);
      key = `Week of ${mon.toISOString().split("T")[0]}`;
    } else {
      const monthStr = (tx.date.getUTCMonth() + 1).toString().padStart(2, "0");
      key = `${tx.date.getUTCFullYear()}-${monthStr}`;
    }

    let b = buckets.get(key);
    if (!b) {
      b = { income: 0, expense: 0 };
      buckets.set(key, b);
    }

    const amt = tx.amount.toNumber();
    if (tx.type === "INCOME") {
      b.income += amt;
    } else if (tx.type === "EXPENSE") {
      b.expense += amt;
    }
  }

  const data: CashFlowPeriodItem[] = Array.from(buckets.entries()).map(([period, values]) => {
    const inc = values.income;
    const exp = values.expense;
    const net = inc - exp;
    return {
      period,
      income: inc.toFixed(2),
      expense: exp.toFixed(2),
      net: net.toFixed(2),
    };
  });

  return {
    dateRange: { from: input.from, to: input.to },
    groupBy,
    data,
  };
};

// ---------------------------------------------------------------------------
// 3. GET /api/reports/categories
// ---------------------------------------------------------------------------

export interface CategoryReportItem {
  categoryId: string;
  categoryName: string;
  amount: string;
  percentage: number;
}

export const getCategorySpendingReport = async (
  userId: string,
  input: ReportDateRangeInput
): Promise<{ dateRange: { from: string; to: string }; totalExpense: string; data: CategoryReportItem[] }> => {
  const startDate = parseStartOfDayUTC(input.from);
  const endDate = parseEndOfDayUTC(input.to);

  const groups = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "EXPENSE",
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: { amount: true },
  });

  const categoryIds = groups.map((g) => g.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, userId },
    select: { id: true, name: true },
  });

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  let totalExpenseNum = 0;
  const rawList = groups.map((g) => {
    const amt = g._sum.amount ? g._sum.amount.toNumber() : 0;
    totalExpenseNum += amt;
    return {
      categoryId: g.categoryId,
      categoryName: catMap.get(g.categoryId) || "Uncategorized",
      amountNum: amt,
    };
  });

  const data: CategoryReportItem[] = rawList
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      amount: item.amountNum.toFixed(2),
      percentage:
        totalExpenseNum > 0
          ? Math.round((item.amountNum / totalExpenseNum) * 100 * 100) / 100
          : 0,
    }))
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

  return {
    dateRange: { from: input.from, to: input.to },
    totalExpense: totalExpenseNum.toFixed(2),
    data,
  };
};

// ---------------------------------------------------------------------------
// 4. GET /api/reports/budgets
// ---------------------------------------------------------------------------

export const getBudgetPerformanceReport = async (
  userId: string,
  input: ReportDateRangeInput
) => {
  const fromDate = parseStartOfDayUTC(input.from);
  const toDate = parseEndOfDayUTC(input.to);

  // Fetch all user budgets and filter those overlapping with reporting window
  const allBudgets: BudgetResponse[] = await getBudgets(userId, {});

  const relevantBudgets = allBudgets.filter((b) => {
    const bStart = new Date(b.startDate);
    const bEnd = new Date(b.endDate);
    return bStart <= toDate && bEnd >= fromDate;
  });

  const items = relevantBudgets.map((b) => ({
    budgetId: b.id,
    name: b.category ? b.category.name : "Overall Budget",
    type: b.type,
    period: b.period,
    startDate: b.startDate,
    endDate: b.endDate,
    amount: b.amount,
    spent: b.spent,
    remaining: b.remaining,
    percentageUsed: b.percentage,
    status: b.status,
  }));

  return {
    dateRange: { from: input.from, to: input.to },
    totalBudgets: items.length,
    budgets: items,
  };
};

// ---------------------------------------------------------------------------
// 5. GET /api/reports/savings
// ---------------------------------------------------------------------------

export const getSavingsReport = async (
  userId: string,
  input: { from: string; to: string; groupBy?: "day" | "week" | "month" }
) => {
  const startDate = parseStartOfDayUTC(input.from);
  const endDate = parseEndOfDayUTC(input.to);
  const groupBy = input.groupBy || "month";

  const summary = await aggregateUserTransactions(userId, startDate, endDate);
  const cashFlow = await getCashFlowReport(userId, {
    from: input.from,
    to: input.to,
    groupBy,
  });

  const breakdown = cashFlow.data.map((item) => ({
    period: item.period,
    income: item.income,
    expense: item.expense,
    savings: item.net,
  }));

  return {
    dateRange: { from: input.from, to: input.to },
    groupBy,
    totalIncome: summary.totalIncome,
    totalExpense: summary.totalExpense,
    totalSavings: summary.savings,
    savingsRate: summary.savingsRate,
    breakdown,
  };
};

// ---------------------------------------------------------------------------
// 6. GET /api/reports/custom
// ---------------------------------------------------------------------------

export const getCustomReport = async (
  userId: string,
  input: CustomReportQueryInput
) => {
  if (input.groupBy === "category") {
    const catReport = await getCategorySpendingReport(userId, {
      from: input.from,
      to: input.to,
    });
    return {
      type: "CATEGORY_BREAKDOWN",
      ...catReport,
    };
  }

  const cashFlowReport = await getCashFlowReport(userId, {
    from: input.from,
    to: input.to,
    groupBy: input.groupBy as "day" | "week" | "month",
  });

  return {
    type: "PERIOD_BREAKDOWN",
    ...cashFlowReport,
  };
};
