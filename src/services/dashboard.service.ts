import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import {
  DashboardQueryInput,
  MonthlyQueryInput,
  TrendsQueryInput,
  Granularity,
} from "../validators/dashboard.validator.js";
import { getBudgets, BudgetResponse } from "./budget.service.js";

// ---------------------------------------------------------------------------
// Date Range & Period Resolution
// ---------------------------------------------------------------------------

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface PeriodComparisonRange {
  current: DateRange;
  previous: DateRange;
}

/**
 * Resolves current and previous symmetric date windows.
 */
export function resolveDateRanges(
  input: { period?: string; startDate?: string; endDate?: string },
  now: Date = new Date()
): PeriodComparisonRange {
  // 1. Custom explicit date range
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(input.endDate);
    end.setUTCHours(23, 59, 59, 999);

    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    prevStart.setUTCHours(0, 0, 0, 0);

    return {
      current: { startDate: start, endDate: end },
      previous: { startDate: prevStart, endDate: prevEnd },
    };
  }

  // 2. Predefined periods (defaults to "month" if none supplied)
  const period = input.period || "month";

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const date = now.getUTCDate();

  switch (period) {
    case "today": {
      const currStart = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
      const currEnd = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));

      const prevDate = new Date(currStart.getTime() - 24 * 60 * 60 * 1000);
      const prevStart = new Date(
        Date.UTC(
          prevDate.getUTCFullYear(),
          prevDate.getUTCMonth(),
          prevDate.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
      const prevEnd = new Date(
        Date.UTC(
          prevDate.getUTCFullYear(),
          prevDate.getUTCMonth(),
          prevDate.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );

      return {
        current: { startDate: currStart, endDate: currEnd },
        previous: { startDate: prevStart, endDate: prevEnd },
      };
    }

    case "week": {
      // 7 days ending today
      const currEnd = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
      const currStart = new Date(currEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      currStart.setUTCHours(0, 0, 0, 0);

      const prevEnd = new Date(currStart.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      prevStart.setUTCHours(0, 0, 0, 0);

      return {
        current: { startDate: currStart, endDate: currEnd },
        previous: { startDate: prevStart, endDate: prevEnd },
      };
    }

    case "year": {
      const currStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const currEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

      const prevStart = new Date(Date.UTC(year - 1, 0, 1, 0, 0, 0, 0));
      const prevEnd = new Date(Date.UTC(year - 1, 11, 31, 23, 59, 59, 999));

      return {
        current: { startDate: currStart, endDate: currEnd },
        previous: { startDate: prevStart, endDate: prevEnd },
      };
    }

    case "month":
    default: {
      // Calendar month
      const lastDayOfCurrMonth = new Date(
        Date.UTC(year, month + 1, 0)
      ).getUTCDate();
      const currStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const currEnd = new Date(
        Date.UTC(year, month, lastDayOfCurrMonth, 23, 59, 59, 999)
      );

      // Previous calendar month
      const prevMonthYear = month === 0 ? year - 1 : year;
      const prevMonth = month === 0 ? 11 : month - 1;
      const lastDayOfPrevMonth = new Date(
        Date.UTC(prevMonthYear, prevMonth + 1, 0)
      ).getUTCDate();

      const prevStart = new Date(
        Date.UTC(prevMonthYear, prevMonth, 1, 0, 0, 0, 0)
      );
      const prevEnd = new Date(
        Date.UTC(prevMonthYear, prevMonth, lastDayOfPrevMonth, 23, 59, 59, 999)
      );

      return {
        current: { startDate: currStart, endDate: currEnd },
        previous: { startDate: prevStart, endDate: prevEnd },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Calculate Percentage Change Safely
// ---------------------------------------------------------------------------

function calcPercentageChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // undefined growth from 0, represented safely as null
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(change * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helper: Query Financial Aggregates
// ---------------------------------------------------------------------------

async function getAggregates(userId: string, range: DateRange) {
  const groups = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      userId,
      date: {
        gte: range.startDate,
        lte: range.endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  let income = 0;
  let expense = 0;
  let transactionCount = 0;

  for (const g of groups) {
    const sum = g._sum.amount ? g._sum.amount.toNumber() : 0;
    const count = g._count.id;
    transactionCount += count;
    if (g.type === "INCOME") {
      income = sum;
    } else if (g.type === "EXPENSE") {
      expense = sum;
    }
  }

  const balance = Math.round((income - expense) * 100) / 100;
  const savingsRate =
    income > 0 ? Math.round(((income - expense) / income) * 100 * 100) / 100 : 0;

  return {
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    balance,
    savingsRate,
    transactionCount,
  };
}

// ---------------------------------------------------------------------------
// 1. GET /api/dashboard/summary
// ---------------------------------------------------------------------------

export const getDashboardSummary = async (
  userId: string,
  query: DashboardQueryInput
) => {
  const ranges = resolveDateRanges(query);

  // 1. Aggregate current and previous periods
  const [curr, prev] = await Promise.all([
    getAggregates(userId, ranges.current),
    getAggregates(userId, ranges.previous),
  ]);

  // 2. Recent Transactions (latest 5)
  const recentTransactionsRaw = await prisma.transaction.findMany({
    where: { userId },
    include: {
      category: {
        select: { id: true, name: true, type: true },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  const recentTransactions = recentTransactionsRaw.map((tx) => ({
    id: tx.id,
    amount: tx.amount.toFixed(2),
    type: tx.type,
    category: tx.category.name,
    note: tx.note,
    date: tx.date,
  }));

  // 3. Top Spending Category in the current period
  const categoryGroups = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "EXPENSE",
      date: {
        gte: ranges.current.startDate,
        lte: ranges.current.endDate,
      },
    },
    _sum: { amount: true },
    orderBy: {
      _sum: { amount: "desc" },
    },
    take: 1,
  });

  let topCategory: { id: string; name: string; amount: number } | null = null;
  if (categoryGroups.length > 0 && categoryGroups[0]._sum.amount) {
    const cat = await prisma.category.findUnique({
      where: { id: categoryGroups[0].categoryId },
    });
    if (cat) {
      topCategory = {
        id: cat.id,
        name: cat.name,
        amount: categoryGroups[0]._sum.amount.toNumber(),
      };
    }
  }

  // 4. Highest Individual Expense in the period
  const highestExpenseTx = await prisma.transaction.findFirst({
    where: {
      userId,
      type: "EXPENSE",
      date: {
        gte: ranges.current.startDate,
        lte: ranges.current.endDate,
      },
    },
    include: { category: true },
    orderBy: { amount: "desc" },
  });

  const highestExpense = highestExpenseTx
    ? {
        id: highestExpenseTx.id,
        amount: highestExpenseTx.amount.toNumber(),
        category: highestExpenseTx.category.name,
        date: highestExpenseTx.date,
      }
    : null;

  // 5. Rule-Based Insights & Alerts (using centralized Budget Service)
  const userBudgets: BudgetResponse[] = await getBudgets(userId, {});

  const insights: Array<{ type: string; severity: string; message: string }> =
    [];
  const alerts: Array<{ type: string; severity: string; message: string }> = [];

  // Spending vs Previous period comparison insights
  const expenseChange = calcPercentageChange(curr.expense, prev.expense);
  if (expenseChange !== null) {
    if (expenseChange < 0) {
      insights.push({
        type: "SPENDING_DECREASE",
        severity: "INFO",
        message: `Your spending is ${Math.abs(expenseChange)}% lower than the previous period.`,
      });
    } else if (expenseChange > 0) {
      insights.push({
        type: "SPENDING_INCREASE",
        severity: "INFO",
        message: `Your spending is ${expenseChange}% higher than the previous period.`,
      });
      if (expenseChange >= 25 && curr.expense > 1000) {
        alerts.push({
          type: "SPENDING_SURGE",
          severity: "WARNING",
          message: `Spending increased by ${expenseChange}% compared to previous period.`,
        });
      }
    }
  }

  // Top Category insight
  if (topCategory && curr.expense > 0) {
    const pct = Math.round((topCategory.amount / curr.expense) * 100);
    insights.push({
      type: "TOP_CATEGORY",
      severity: "INFO",
      message: `${topCategory.name} is your highest expense category (${pct}% of total spending).`,
    });
  }

  // Budget Alerts (Reusing calculated budget status)
  for (const b of userBudgets) {
    const name = b.category ? b.category.name : "Overall Budget";
    if (b.status === "EXCEEDED") {
      alerts.push({
        type: "BUDGET_EXCEEDED",
        severity: "CRITICAL",
        message: `${name} has exceeded its allocated limit (${b.percentage}% used).`,
      });
    } else if (b.status === "CRITICAL") {
      alerts.push({
        type: "BUDGET_CRITICAL",
        severity: "WARNING",
        message: `${name} is at critical limit (${b.percentage}% used).`,
      });
    } else if (b.status === "WARNING") {
      alerts.push({
        type: "BUDGET_WARNING",
        severity: "WARNING",
        message: `${name} has reached ${b.percentage}% of its limit.`,
      });
    }
  }

  return {
    period: query.period || "month",
    dateRange: {
      startDate: ranges.current.startDate,
      endDate: ranges.current.endDate,
    },
    current: curr,
    previous: prev,
    comparison: {
      incomeChangePercentage: calcPercentageChange(curr.income, prev.income),
      expenseChangePercentage: expenseChange,
      balanceChangePercentage: calcPercentageChange(curr.balance, prev.balance),
    },
    recentTransactions,
    topCategory,
    highestExpense,
    insights,
    alerts,
  };
};

// ---------------------------------------------------------------------------
// 2. GET /api/dashboard/monthly (ALWAYS returns all 12 months)
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const getMonthlyAnalytics = async (
  userId: string,
  query: MonthlyQueryInput
) => {
  const targetYear = query.year;
  const startOfYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
  const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    select: {
      amount: true,
      type: true,
      date: true,
    },
  });

  // Initialize all 12 months with zeros
  const monthlyData = MONTH_NAMES.map((name, index) => ({
    month: name,
    monthIndex: index + 1,
    income: 0,
    expense: 0,
    balance: 0,
  }));

  for (const tx of transactions) {
    const monthIdx = tx.date.getUTCMonth(); // 0 to 11
    const amount = tx.amount.toNumber();
    if (tx.type === "INCOME") {
      monthlyData[monthIdx].income += amount;
    } else if (tx.type === "EXPENSE") {
      monthlyData[monthIdx].expense += amount;
    }
  }

  let totalIncome = 0;
  let totalExpense = 0;

  for (const m of monthlyData) {
    m.income = Math.round(m.income * 100) / 100;
    m.expense = Math.round(m.expense * 100) / 100;
    m.balance = Math.round((m.income - m.expense) * 100) / 100;
    totalIncome += m.income;
    totalExpense += m.expense;
  }

  return {
    year: targetYear,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netSavings: Math.round((totalIncome - totalExpense) * 100) / 100,
    data: monthlyData,
  };
};

// ---------------------------------------------------------------------------
// 3. GET /api/dashboard/categories (Expense breakdown with percentages)
// ---------------------------------------------------------------------------

export const getCategoryAnalytics = async (
  userId: string,
  query: DashboardQueryInput
) => {
  const ranges = resolveDateRanges(query);

  const groups = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "EXPENSE",
      date: {
        gte: ranges.current.startDate,
        lte: ranges.current.endDate,
      },
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  // Fetch category metadata
  const categoryIds = groups.map((g) => g.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, userId },
    select: { id: true, name: true },
  });

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  let totalExpense = 0;
  const rawList = groups.map((g) => {
    const amount = g._sum.amount ? g._sum.amount.toNumber() : 0;
    totalExpense += amount;
    return {
      categoryId: g.categoryId,
      categoryName: catMap.get(g.categoryId) || "Uncategorized",
      amount: Math.round(amount * 100) / 100,
      transactionCount: g._count.id,
    };
  });

  // Calculate percentages and sort descending by amount
  const data = rawList
    .map((item) => ({
      ...item,
      percentage:
        totalExpense > 0
          ? Math.round((item.amount / totalExpense) * 100 * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    dateRange: {
      startDate: ranges.current.startDate,
      endDate: ranges.current.endDate,
    },
    totalExpense: Math.round(totalExpense * 100) / 100,
    categoryCount: data.length,
    data,
  };
};

// ---------------------------------------------------------------------------
// 4. GET /api/dashboard/trends (Spending time-series with automatic/explicit granularity)
// ---------------------------------------------------------------------------

export const getSpendingTrends = async (
  userId: string,
  query: TrendsQueryInput
) => {
  const ranges = resolveDateRanges(query);
  const { startDate, endDate } = ranges.current;

  // Determine granularity: explicit or auto-resolved
  const diffDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let granularity: Granularity = query.granularity as Granularity;
  if (!granularity) {
    if (diffDays <= 31) {
      granularity = "daily";
    } else if (diffDays <= 90) {
      granularity = "weekly";
    } else {
      granularity = "monthly";
    }
  }

  // Fetch expense transactions in range
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "EXPENSE",
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      amount: true,
      date: true,
    },
    orderBy: { date: "asc" },
  });

  // Aggregate into buckets based on granularity
  const buckets = new Map<string, number>();

  if (granularity === "daily") {
    // Fill all days in range with 0
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const key = cur.toISOString().split("T")[0]; // YYYY-MM-DD
      buckets.set(key, 0);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    for (const tx of transactions) {
      const key = tx.date.toISOString().split("T")[0];
      buckets.set(key, (buckets.get(key) || 0) + tx.amount.toNumber());
    }
  } else if (granularity === "weekly") {
    // Bucket by ISO week starting date
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const key = `Week of ${cur.toISOString().split("T")[0]}`;
      buckets.set(key, 0);
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
    for (const tx of transactions) {
      const diff = Math.floor(
        (tx.date.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const weekStart = new Date(startDate.getTime() + diff * 7 * 24 * 60 * 60 * 1000);
      const key = `Week of ${weekStart.toISOString().split("T")[0]}`;
      buckets.set(key, (buckets.get(key) || 0) + tx.amount.toNumber());
    }
  } else {
    // monthly
    for (const tx of transactions) {
      const monthKey = `${MONTH_NAMES[tx.date.getUTCMonth()]} ${tx.date.getUTCFullYear()}`;
      buckets.set(monthKey, (buckets.get(monthKey) || 0) + tx.amount.toNumber());
    }
  }

  let totalExpense = 0;
  let highestSpendingAmount = 0;
  let highestSpendingDay: string | null = null;

  const data = Array.from(buckets.entries()).map(([dateLabel, expense]) => {
    const rounded = Math.round(expense * 100) / 100;
    totalExpense += rounded;
    if (rounded > highestSpendingAmount) {
      highestSpendingAmount = rounded;
      highestSpendingDay = dateLabel;
    }
    return {
      date: dateLabel,
      expense: rounded,
    };
  });

  const activeDaysCount = Math.max(diffDays, 1);
  const averageDailyExpense =
    Math.round((totalExpense / activeDaysCount) * 100) / 100;

  return {
    granularity,
    dateRange: { startDate, endDate },
    totalExpense: Math.round(totalExpense * 100) / 100,
    averageDailyExpense,
    highestSpendingDay,
    highestSpendingAmount,
    data,
  };
};

// ---------------------------------------------------------------------------
// 5. GET /api/dashboard/budget-overview (100% REUSES budget.service.ts)
// ---------------------------------------------------------------------------

export const getBudgetOverview = async (userId: string) => {
  // Directly calling centralized budget service — NEVER DUPLICATES CALCULATION LOGIC
  const budgets: BudgetResponse[] = await getBudgets(userId, {});

  let totalAllocated = 0;
  let totalSpent = 0;
  let activeBudgetsCount = 0;
  let criticalBudgetsCount = 0;
  let exceededBudgetsCount = 0;

  const budgetItems = budgets.map((b) => {
    const amountNum = parseFloat(b.amount);
    const spentNum = parseFloat(b.spent);

    totalAllocated += amountNum;
    totalSpent += spentNum;

    if (b.isActive) activeBudgetsCount++;
    if (b.status === "CRITICAL") criticalBudgetsCount++;
    if (b.status === "EXCEEDED") exceededBudgetsCount++;

    return {
      id: b.id,
      name: b.category ? b.category.name : "Overall Budget",
      type: b.type,
      period: b.period,
      amount: amountNum,
      spent: spentNum,
      remaining: parseFloat(b.remaining),
      percentage: b.percentage,
      status: b.status,
      isActive: b.isActive,
    };
  });

  const totalRemaining = Math.round((totalAllocated - totalSpent) * 100) / 100;
  const overallPercentage =
    totalAllocated > 0
      ? Math.round((totalSpent / totalAllocated) * 100)
      : 0;

  return {
    totalBudgets: budgets.length,
    activeBudgets: activeBudgetsCount,
    criticalBudgets: criticalBudgetsCount,
    exceededBudgets: exceededBudgetsCount,
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalRemaining,
    overallPercentage,
    budgets: budgetItems,
  };
};
