/**
 * Budget Integration Tests
 * Tests: GET/POST /api/budgets, GET/PATCH/DELETE /api/budgets/:id
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  api,
  createTestUser,
  cleanUsers,
  authGet,
  authPost,
  authPatch,
  authDelete,
  type TestUser,
} from "../helpers/testHelpers.js";

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

let userA: TestUser;
let userB: TestUser;
let expenseCatId: string;   // userA EXPENSE category
let incomeCatId: string;    // userA INCOME category
let bExpenseCatId: string;  // userB EXPENSE category

// Deterministic budget dates
const WEEKLY_START = "2026-06-01";
const WEEKLY_END = "2026-06-07";
const MONTHLY_START = "2026-07-01";
const MONTHLY_END = "2026-07-31";
const CUSTOM_START = "2026-08-01";
const CUSTOM_END = "2026-08-20";

beforeAll(async () => {
  userA = await createTestUser("bud_a");
  userB = await createTestUser("bud_b");

  const expCat = await authPost(userA.token, "/api/categories", { name: "BudExpense", type: "EXPENSE" });
  expenseCatId = expCat.body.data.id;

  const incCat = await authPost(userA.token, "/api/categories", { name: "BudIncome", type: "INCOME" });
  incomeCatId = incCat.body.data.id;

  const bCat = await authPost(userB.token, "/api/categories", { name: "BBudExpense", type: "EXPENSE" });
  bExpenseCatId = bCat.body.data.id;
});

afterAll(async () => {
  await cleanUsers(userA.email, userB.email);
});

// ---------------------------------------------------------------------------
// Create Budget — OVERALL
// ---------------------------------------------------------------------------

describe("Budgets — POST /api/budgets (OVERALL)", () => {
  it("201 — creates OVERALL CUSTOM budget", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 1000,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      amount: "1000.00",
      type: "OVERALL",
      period: "CUSTOM",
      spent: expect.any(String),
      remaining: expect.any(String),
      percentage: expect.any(Number),
      status: expect.any(String),
    });
    expect(res.body.data.category).toBeNull();
  });

  it("201 — creates OVERALL MONTHLY budget", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 2000,
      type: "OVERALL",
      period: "MONTHLY",
      startDate: MONTHLY_START,
      endDate: MONTHLY_END,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.period).toBe("MONTHLY");
  });

  it("201 — creates OVERALL WEEKLY budget", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "OVERALL",
      period: "WEEKLY",
      startDate: WEEKLY_START,
      endDate: WEEKLY_END,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.period).toBe("WEEKLY");
  });

  it("400 — OVERALL budget with categoryId is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
      categoryId: expenseCatId,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.post("/api/budgets").send({
      amount: 100,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Create Budget — CATEGORY
// ---------------------------------------------------------------------------

describe("Budgets — POST /api/budgets (CATEGORY)", () => {
  it("201 — creates CATEGORY CUSTOM budget with expense category", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 300,
      type: "CATEGORY",
      period: "CUSTOM",
      startDate: "2026-09-01",
      endDate: "2026-09-15",
      categoryId: expenseCatId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("CATEGORY");
    expect(res.body.data.category).toMatchObject({ id: expenseCatId });
  });

  it("400 — CATEGORY budget without categoryId is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 300,
      type: "CATEGORY",
      period: "CUSTOM",
      startDate: "2026-09-16",
      endDate: "2026-09-30",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("404 — CATEGORY budget with nonexistent categoryId is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 300,
      type: "CATEGORY",
      period: "CUSTOM",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
      categoryId: "00000000-0000-0000-0000-000000000000",
    });
    expect(res.status).toBe(404);
  });

  it("404 — cannot use User B's category for User A's budget", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 300,
      type: "CATEGORY",
      period: "CUSTOM",
      startDate: "2026-10-16",
      endDate: "2026-10-31",
      categoryId: bExpenseCatId,
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("Budgets — Validation", () => {
  it("400 — missing amount is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      type: "OVERALL",
      period: "CUSTOM",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(400);
  });

  it("400 — zero amount is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 0,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(400);
  });

  it("400 — negative amount is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: -100,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid budget type is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "PERSONAL",
      period: "CUSTOM",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid period is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "OVERALL",
      period: "DAILY",
      startDate: CUSTOM_START,
      endDate: CUSTOM_END,
    });
    expect(res.status).toBe(400);
  });

  it("400 — endDate before startDate is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: "2026-08-20",
      endDate: "2026-08-01",
    });
    expect(res.status).toBe(400);
  });

  it("400 — WEEKLY budget with incorrect date range (not 7 days) is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "OVERALL",
      period: "WEEKLY",
      startDate: "2026-06-01",
      endDate: "2026-06-10", // 10 days, not 7
    });
    expect(res.status).toBe(400);
  });

  it("400 — MONTHLY budget with startDate not 1st of month is rejected", async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 500,
      type: "OVERALL",
      period: "MONTHLY",
      startDate: "2026-07-05",
      endDate: "2026-07-31",
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// List / Read Budgets
// ---------------------------------------------------------------------------

describe("Budgets — GET /api/budgets", () => {
  it("200 — returns array of user budgets with computed fields", async () => {
    const res = await authGet(userA.token, "/api/budgets");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      const b = res.body.data[0];
      expect(b.spent).toBeDefined();
      expect(b.remaining).toBeDefined();
      expect(b.percentage).toBeDefined();
      expect(b.status).toBeDefined();
    }
  });

  it("200 — empty result for new user", async () => {
    const freshUser = await createTestUser("bud_empty");
    try {
      const res = await authGet(freshUser.token, "/api/budgets");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("200 — User B cannot see User A's budgets (isolation)", async () => {
    const resA = await authGet(userA.token, "/api/budgets");
    const resB = await authGet(userB.token, "/api/budgets");
    const aIds = resA.body.data.map((b: { id: string }) => b.id);
    const bIds = resB.body.data.map((b: { id: string }) => b.id);
    const overlap = aIds.filter((id: string) => bIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.get("/api/budgets");
    expect(res.status).toBe(401);
  });
});

describe("Budgets — GET /api/budgets/:id", () => {
  let budgetId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 750,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
    budgetId = res.body.data.id;
  });

  it("200 — returns owned budget by ID", async () => {
    const res = await authGet(userA.token, `/api/budgets/${budgetId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(budgetId);
  });

  it("404 — nonexistent budget returns 404", async () => {
    const res = await authGet(userA.token, "/api/budgets/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot read User A's budget", async () => {
    const res = await authGet(userB.token, `/api/budgets/${budgetId}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Progress / Spend calculations
// ---------------------------------------------------------------------------

describe("Budgets — Spending calculations", () => {
  it("new budget with no spending shows spent=0, remaining=amount, percentage=0, status=ON_TRACK", async () => {
    const freshUser = await createTestUser("bud_spend");
    try {
      const catRes = await authPost(freshUser.token, "/api/categories", { name: "SpendCat", type: "EXPENSE" });
      const catId = catRes.body.data.id;

      const budRes = await authPost(freshUser.token, "/api/budgets", {
        amount: "500.00",
        type: "OVERALL",
        period: "CUSTOM",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      });
      const budgetId = budRes.body.data.id;

      // No transactions yet
      const res = await authGet(freshUser.token, `/api/budgets/${budgetId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.spent).toBe("0.00");
      expect(res.body.data.remaining).toBe("500.00");
      expect(res.body.data.percentage).toBe(0);
      expect(res.body.data.status).toBe("ON_TRACK");

      // Add spending inside budget period
      await authPost(freshUser.token, "/api/transactions", {
        amount: 250,
        type: "EXPENSE",
        categoryId: catId,
        date: "2026-05-15",
      });

      const res2 = await authGet(freshUser.token, `/api/budgets/${budgetId}`);
      expect(parseFloat(res2.body.data.spent)).toBe(250);
      expect(parseFloat(res2.body.data.remaining)).toBe(250);
      expect(res2.body.data.percentage).toBe(50);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });
});

// ---------------------------------------------------------------------------
// Update Budget
// ---------------------------------------------------------------------------

describe("Budgets — PATCH /api/budgets/:id", () => {
  let budgetId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/budgets", {
      amount: 400,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: "2026-12-01",
      endDate: "2026-12-15",
    });
    budgetId = res.body.data.id;
  });

  it("200 — updates budget amount", async () => {
    const res = await authPatch(userA.token, `/api/budgets/${budgetId}`, { amount: 600 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe("600.00");
  });

  it("400 — empty body is rejected", async () => {
    const res = await authPatch(userA.token, `/api/budgets/${budgetId}`, {});
    expect(res.status).toBe(400);
  });

  it("404 — updating nonexistent budget returns 404", async () => {
    const res = await authPatch(userA.token, "/api/budgets/00000000-0000-0000-0000-000000000000", { amount: 100 });
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot update User A's budget", async () => {
    const res = await authPatch(userB.token, `/api/budgets/${budgetId}`, { amount: 9999 });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Delete Budget
// ---------------------------------------------------------------------------

describe("Budgets — DELETE /api/budgets/:id", () => {
  it("200 — deletes owned budget", async () => {
    const created = await authPost(userA.token, "/api/budgets", {
      amount: 100,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    });
    const id = created.body.data.id;

    const res = await authDelete(userA.token, `/api/budgets/${id}`);
    expect(res.status).toBe(200);

    const check = await authGet(userA.token, `/api/budgets/${id}`);
    expect(check.status).toBe(404);
  });

  it("404 — deleting nonexistent budget returns 404", async () => {
    const res = await authDelete(userA.token, "/api/budgets/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot delete User A's budget", async () => {
    const created = await authPost(userA.token, "/api/budgets", {
      amount: 100,
      type: "OVERALL",
      period: "CUSTOM",
      startDate: "2025-02-01",
      endDate: "2025-02-28",
    });
    const res = await authDelete(userB.token, `/api/budgets/${created.body.data.id}`);
    expect(res.status).toBe(404);
  });

  it("401 — unauthenticated delete is rejected", async () => {
    const res = await api.delete("/api/budgets/some-id");
    expect(res.status).toBe(401);
  });
});
