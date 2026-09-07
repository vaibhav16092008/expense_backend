/**
 * Phase 5 — Reports & Advanced Financial Analytics Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  api,
  createTestUser,
  cleanUsers,
  authGet,
  authPost,
  type TestUser,
} from "../helpers/testHelpers.js";

describe("Phase 5 — Reports & Financial Analytics", () => {
  let userA: TestUser;
  let userB: TestUser;
  let catAExpense: string;
  let catAIncome: string;
  let catBExpense: string;

  beforeAll(async () => {
    userA = await createTestUser("report_a");
    userB = await createTestUser("report_b");

    // Categories for User A
    const resCatAExp = await authPost(userA.token, "/api/categories", {
      name: "Food & Dining",
      type: "EXPENSE",
    });
    catAExpense = resCatAExp.body.data.id;

    const resCatAInc = await authPost(userA.token, "/api/categories", {
      name: "Salary",
      type: "INCOME",
    });
    catAIncome = resCatAInc.body.data.id;

    // Category for User B
    const resCatBExp = await authPost(userB.token, "/api/categories", {
      name: "UserB Expense",
      type: "EXPENSE",
    });
    catBExpense = resCatBExp.body.data.id;

    // Seed transactions for User A (March 2026)
    await authPost(userA.token, "/api/transactions", {
      amount: 5000,
      type: "INCOME",
      categoryId: catAIncome,
      date: "2026-03-01",
    });

    await authPost(userA.token, "/api/transactions", {
      amount: 1200,
      type: "EXPENSE",
      categoryId: catAExpense,
      date: "2026-03-05",
      note: "Grocery shopping",
    });

    await authPost(userA.token, "/api/transactions", {
      amount: 800,
      type: "EXPENSE",
      categoryId: catAExpense,
      date: "2026-03-15",
      note: "Restaurant",
    });

    // Seed transaction for User B (March 2026) — User isolation test
    await authPost(userB.token, "/api/transactions", {
      amount: 9999,
      type: "EXPENSE",
      categoryId: catBExpense,
      date: "2026-03-10",
    });

    // Seed Budget for User A in March 2026 (Overlapping)
    await authPost(userA.token, "/api/budgets", {
      amount: 2500,
      type: "CATEGORY",
      period: "MONTHLY",
      categoryId: catAExpense,
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });

    // Seed Budget for User A in January 2026 (Non-overlapping for March report)
    await authPost(userA.token, "/api/budgets", {
      amount: 1000,
      type: "CATEGORY",
      period: "MONTHLY",
      categoryId: catAExpense,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });

  afterAll(async () => {
    await cleanUsers(userA.email, userB.email);
  });

  // -------------------------------------------------------------------------
  // 1. Authentication Check
  // -------------------------------------------------------------------------
  describe("Authentication Enforcement", () => {
    const reportEndpoints = [
      "/api/reports/summary?from=2026-03-01&to=2026-03-31",
      "/api/reports/cash-flow?from=2026-03-01&to=2026-03-31",
      "/api/reports/categories?from=2026-03-01&to=2026-03-31",
      "/api/reports/budgets?from=2026-03-01&to=2026-03-31",
      "/api/reports/savings?from=2026-03-01&to=2026-03-31",
      "/api/reports/custom?from=2026-03-01&to=2026-03-31",
    ];

    for (const endpoint of reportEndpoints) {
      it(`401 — ${endpoint} rejects unauthenticated request`, async () => {
        const res = await api.get(endpoint);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Strict Date Validation
  // -------------------------------------------------------------------------
  describe("Date Validation & Edge Cases", () => {
    it("400 — rejects request when 'from' date is missing", async () => {
      const res = await authGet(userA.token, "/api/reports/summary?to=2026-03-31");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("400 — rejects request when 'to' date is missing", async () => {
      const res = await authGet(userA.token, "/api/reports/summary?from=2026-03-01");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("400 — rejects malformed date format", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=invalid-date&to=2026-03-31"
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("400 — rejects non-existent calendar date (2026-02-30)", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=2026-02-30&to=2026-03-31"
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("400 — rejects non-existent calendar date (2026-04-31)", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=2026-04-01&to=2026-04-31"
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("400 — rejects when from > to", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=2026-03-31&to=2026-03-01"
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("200 — accepts same-day date range (from === to)", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=2026-03-05&to=2026-03-05"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalExpense).toBe("1200.00");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Financial Summary Report
  // -------------------------------------------------------------------------
  describe("GET /api/reports/summary", () => {
    it("200 — calculates income, expense, savings, and savings rate correctly", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.totalIncome).toBe("5000.00");
      expect(data.totalExpense).toBe("2000.00");
      expect(data.savings).toBe("3000.00");
      expect(data.savingsRate).toBe(60);
    });

    it("200 — handles zero income safely without NaN or Infinity", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/summary?from=2026-03-02&to=2026-03-06"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.totalIncome).toBe("0.00");
      expect(data.totalExpense).toBe("1200.00");
      expect(data.savings).toBe("-1200.00");
      expect(data.savingsRate).toBe(0);
    });

    it("200 — enforces user isolation (User B sees zero User A data)", async () => {
      const res = await authGet(
        userB.token,
        "/api/reports/summary?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.totalIncome).toBe("0.00");
      expect(res.body.data.totalExpense).toBe("9999.00");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cash Flow Report
  // -------------------------------------------------------------------------
  describe("GET /api/reports/cash-flow", () => {
    it("200 — defaults to monthly grouping", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/cash-flow?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.groupBy).toBe("month");
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0]).toEqual({
        period: "2026-03",
        income: "5000.00",
        expense: "2000.00",
        net: "3000.00",
      });
    });

    it("200 — supports daily grouping", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/cash-flow?from=2026-03-01&to=2026-03-05&groupBy=day"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.groupBy).toBe("day");
      expect(res.body.data.data.length).toBe(5);

      const day5 = res.body.data.data.find(
        (item: { period: string }) => item.period === "2026-03-05"
      );
      expect(day5).toBeDefined();
      expect(day5.expense).toBe("1200.00");
    });

    it("200 — supports ISO Monday weekly grouping ('Week of YYYY-MM-DD')", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/cash-flow?from=2026-03-01&to=2026-03-31&groupBy=week"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.groupBy).toBe("week");
      expect(res.body.data.data.length).toBeGreaterThan(0);
      expect(res.body.data.data[0].period).toMatch(/^Week of \d{4}-\d{2}-\d{2}$/);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Category Spending Report
  // -------------------------------------------------------------------------
  describe("GET /api/reports/categories", () => {
    it("200 — calculates category expenses and percentages correctly", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/categories?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalExpense).toBe("2000.00");
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0]).toEqual({
        categoryId: catAExpense,
        categoryName: "Food & Dining",
        amount: "2000.00",
        percentage: 100,
      });
    });

    it("200 — handles period with zero expenses safely", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/categories?from=2026-03-01&to=2026-03-02"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.totalExpense).toBe("0.00");
      expect(res.body.data.data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Budget Performance Report
  // -------------------------------------------------------------------------
  describe("GET /api/reports/budgets", () => {
    it("200 — processes only budgets overlapping with selected date range", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/budgets?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // User A has 2 budgets total (Jan & March), but only March budget overlaps [2026-03-01, 2026-03-31]
      expect(res.body.data.totalBudgets).toBe(1);

      const b = res.body.data.budgets[0];
      expect(b.name).toBe("Food & Dining");
      expect(b.amount).toBe("2500.00");
      expect(b.spent).toBe("2000.00");
      expect(b.remaining).toBe("500.00");
      expect(b.percentageUsed).toBe(80);
      expect(b.status).toBe("WARNING"); // 80% >= 70% threshold -> WARNING
    });

    it("200 — respects user isolation for budgets", async () => {
      const res = await authGet(
        userB.token,
        "/api/reports/budgets?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.totalBudgets).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Savings Report
  // -------------------------------------------------------------------------
  describe("GET /api/reports/savings", () => {
    it("200 — returns savings summary and monthly breakdown by default", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/savings?from=2026-03-01&to=2026-03-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.groupBy).toBe("month");
      expect(data.totalIncome).toBe("5000.00");
      expect(data.totalExpense).toBe("2000.00");
      expect(data.totalSavings).toBe("3000.00");
      expect(data.savingsRate).toBe(60);
      expect(data.breakdown).toHaveLength(1);
      expect(data.breakdown[0]).toEqual({
        period: "2026-03",
        income: "5000.00",
        expense: "2000.00",
        savings: "3000.00",
      });
    });

    it("200 — supports configurable period-wise granularity (groupBy=day)", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/savings?from=2026-03-01&to=2026-03-05&groupBy=day"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.groupBy).toBe("day");
      expect(res.body.data.breakdown).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Custom Report
  // -------------------------------------------------------------------------
  describe("GET /api/reports/custom", () => {
    it("200 — returns period breakdown when groupBy=month", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/custom?from=2026-03-01&to=2026-03-31&groupBy=month"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe("PERIOD_BREAKDOWN");
      expect(res.body.data.data).toHaveLength(1);
    });

    it("200 — returns category breakdown when groupBy=category", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/custom?from=2026-03-01&to=2026-03-31&groupBy=category"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe("CATEGORY_BREAKDOWN");
      expect(res.body.data.data).toHaveLength(1);
    });

    it("400 — rejects invalid groupBy parameter", async () => {
      const res = await authGet(
        userA.token,
        "/api/reports/custom?from=2026-03-01&to=2026-03-31&groupBy=invalid"
      );
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
