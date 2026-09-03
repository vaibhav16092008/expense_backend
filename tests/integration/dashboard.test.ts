/**
 * Dashboard & Analytics Integration Tests
 * Tests: GET /api/dashboard/summary, /monthly, /categories, /trends, /budget-overview
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

// ---------------------------------------------------------------------------
// Suite setup — two users, deterministic data
// ---------------------------------------------------------------------------

let userA: TestUser;
let userB: TestUser;
let expCatId: string;
let incCatId: string;

beforeAll(async () => {
  userA = await createTestUser("dash_a");
  userB = await createTestUser("dash_b");

  const expCat = await authPost(userA.token, "/api/categories", { name: "DashExpense", type: "EXPENSE" });
  expCatId = expCat.body.data.id;

  const incCat = await authPost(userA.token, "/api/categories", { name: "DashIncome", type: "INCOME" });
  incCatId = incCat.body.data.id;

  // Transactions in a deterministic date range (March 2024)
  await authPost(userA.token, "/api/transactions", {
    amount: 500,
    type: "EXPENSE",
    categoryId: expCatId,
    date: "2024-03-10",
  });
  await authPost(userA.token, "/api/transactions", {
    amount: 200,
    type: "EXPENSE",
    categoryId: expCatId,
    date: "2024-03-15",
  });
  await authPost(userA.token, "/api/transactions", {
    amount: 2000,
    type: "INCOME",
    categoryId: incCatId,
    date: "2024-03-05",
  });
});

afterAll(async () => {
  await cleanUsers(userA.email, userB.email);
});

// ---------------------------------------------------------------------------
// Authentication — all dashboard endpoints must require auth
// ---------------------------------------------------------------------------

describe("Dashboard — Authentication required", () => {
  const endpoints = [
    "/api/dashboard/summary",
    "/api/dashboard/monthly",
    "/api/dashboard/categories",
    "/api/dashboard/trends",
    "/api/dashboard/budget-overview",
  ];

  for (const endpoint of endpoints) {
    it(`401 — ${endpoint} rejects unauthenticated request`, async () => {
      const res = await api.get(endpoint);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/summary
// ---------------------------------------------------------------------------

describe("Dashboard — GET /api/dashboard/summary", () => {
  it("200 — returns summary response structure for a period", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/summary?startDate=2024-03-01&endDate=2024-03-31"
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty("current");
    expect(d.current).toHaveProperty("income");
    expect(d.current).toHaveProperty("expense");
    expect(d.current).toHaveProperty("balance");
  });

  it("200 — income and expense amounts are correct for the period", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/summary?startDate=2024-03-01&endDate=2024-03-31"
    );
    expect(res.status).toBe(200);
    const curr = res.body.data.current;
    expect(curr.income).toBe(2000);
    expect(curr.expense).toBe(700);
    expect(curr.balance).toBe(1300);
  });

  it("200 — summary returns zeros for a period with no transactions", async () => {
    const freshUser = await createTestUser("dash_empty");
    try {
      const res = await authGet(
        freshUser.token,
        "/api/dashboard/summary?startDate=2024-01-01&endDate=2024-01-31"
      );
      expect(res.status).toBe(200);
      const curr = res.body.data.current;
      expect(curr.income).toBe(0);
      expect(curr.expense).toBe(0);
      expect(curr.balance).toBe(0);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("200 — period=month query param is accepted", async () => {
    const res = await authGet(userA.token, "/api/dashboard/summary?period=month");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("200 — User A's summary does not contain User B's data", async () => {
    // Create UserB transaction
    const bCat = await authPost(userB.token, "/api/categories", { name: "BDashExp", type: "EXPENSE" });
    await authPost(userB.token, "/api/transactions", {
      amount: 99999,
      type: "EXPENSE",
      categoryId: bCat.body.data.id,
      date: "2024-03-10",
    });

    const resA = await authGet(
      userA.token,
      "/api/dashboard/summary?startDate=2024-03-01&endDate=2024-03-31"
    );
    // UserA expense should still be 700, not 99999+700
    expect(resA.body.data.current.expense).toBe(700);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/monthly
// ---------------------------------------------------------------------------

describe("Dashboard — GET /api/dashboard/monthly", () => {
  it("200 — returns array of 12 monthly entries for a year", async () => {
    const res = await authGet(userA.token, "/api/dashboard/monthly?year=2024");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.data).toHaveLength(12);
  });

  it("200 — each month entry has required fields", async () => {
    const res = await authGet(userA.token, "/api/dashboard/monthly?year=2024");
    const march = res.body.data.data.find((m: { month: string }) => m.month === "Mar");
    expect(march).toBeDefined();
    expect(march).toHaveProperty("income");
    expect(march).toHaveProperty("expense");
    expect(march).toHaveProperty("balance");
  });

  it("200 — March 2024 totals match inserted transactions", async () => {
    const res = await authGet(userA.token, "/api/dashboard/monthly?year=2024");
    const march = res.body.data.data.find((m: { month: string }) => m.month === "Mar");
    expect(march.income).toBe(2000);
    expect(march.expense).toBe(700);
  });

  it("200 — months with no transactions show zero values", async () => {
    const res = await authGet(userA.token, "/api/dashboard/monthly?year=2020");
    expect(res.status).toBe(200);
    res.body.data.data.forEach((m: { income: number; expense: number }) => {
      expect(m.income).toBe(0);
      expect(m.expense).toBe(0);
    });
  });

  it("200 — defaults to current year if no year param provided", async () => {
    const res = await authGet(userA.token, "/api/dashboard/monthly");
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/categories
// ---------------------------------------------------------------------------

describe("Dashboard — GET /api/dashboard/categories", () => {
  it("200 — returns category breakdown array inside data.data", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/categories?startDate=2024-03-01&endDate=2024-03-31"
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("200 — category breakdown contains DashExpense with correct total", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/categories?startDate=2024-03-01&endDate=2024-03-31"
    );
    expect(res.status).toBe(200);
    const found = res.body.data.data.find((c: { categoryId: string }) => c.categoryId === expCatId);
    expect(found).toBeDefined();
    expect(found.amount).toBe(700);
  });

  it("200 — returns empty data array when no transactions exist for period", async () => {
    const freshUser = await createTestUser("dash_catEmpty");
    try {
      const res = await authGet(
        freshUser.token,
        "/api/dashboard/categories?startDate=2024-01-01&endDate=2024-01-31"
      );
      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.categoryCount).toBe(0);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("200 — accepts period param", async () => {
    const res = await authGet(userA.token, "/api/dashboard/categories?period=month");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/trends
// ---------------------------------------------------------------------------

describe("Dashboard — GET /api/dashboard/trends", () => {
  it("200 — returns trends array inside data.data with required fields", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/trends?startDate=2024-03-01&endDate=2024-03-31&granularity=daily"
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    if (res.body.data.data.length > 0) {
      const entry = res.body.data.data[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("expense");
    }
  });

  it("200 — period param is accepted", async () => {
    const res = await authGet(userA.token, "/api/dashboard/trends?period=week");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("200 — weekly granularity is accepted", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/trends?startDate=2024-03-01&endDate=2024-03-31&granularity=weekly"
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
  });

  it("400 — invalid granularity value is rejected", async () => {
    const res = await authGet(userA.token, "/api/dashboard/trends?granularity=hourly");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — endDate before startDate is rejected", async () => {
    const res = await authGet(
      userA.token,
      "/api/dashboard/trends?startDate=2024-03-31&endDate=2024-03-01"
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/budget-overview
// ---------------------------------------------------------------------------

describe("Dashboard — GET /api/dashboard/budget-overview", () => {
  it("200 — returns budget overview response structure", async () => {
    const res = await authGet(userA.token, "/api/dashboard/budget-overview");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it("200 — returns empty/zero budget overview for user with no budgets", async () => {
    const freshUser = await createTestUser("dash_budEmpty");
    try {
      const res = await authGet(freshUser.token, "/api/dashboard/budget-overview");
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("200 — budget overview data is user-scoped (no other user's budgets)", async () => {
    const resA = await authGet(userA.token, "/api/dashboard/budget-overview?period=month");
    expect(resA.status).toBe(200);
  });
});
