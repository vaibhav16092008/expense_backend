import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  cleanUsers,
  authPost,
  authGet,
  type TestUser,
} from "../helpers/testHelpers.js";

describe("Phase 4 — Budget N+1 Optimization & Parity", () => {
  let userA: TestUser;
  let catGroceries: string;
  let catUtilities: string;

  beforeAll(async () => {
    userA = await createTestUser("budget_n1_a");

    const c1 = await authPost(userA.token, "/api/categories", {
      name: "N1 Groceries",
      type: "EXPENSE",
    });
    catGroceries = c1.body.data.id;

    const c2 = await authPost(userA.token, "/api/categories", {
      name: "N1 Utilities",
      type: "EXPENSE",
    });
    catUtilities = c2.body.data.id;

    // Create OVERALL and CATEGORY budgets
    await authPost(userA.token, "/api/budgets", {
      amount: 1000,
      type: "OVERALL",
      period: "MONTHLY",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    await authPost(userA.token, "/api/budgets", {
      amount: 400,
      type: "CATEGORY",
      categoryId: catGroceries,
      period: "MONTHLY",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    // Add transactions
    await authPost(userA.token, "/api/transactions", {
      amount: 150,
      type: "EXPENSE",
      categoryId: catGroceries,
      date: "2026-09-05",
    });

    await authPost(userA.token, "/api/transactions", {
      amount: 100,
      type: "EXPENSE",
      categoryId: catUtilities,
      date: "2026-09-10",
    });
  });

  afterAll(async () => {
    await cleanUsers(userA.email);
  });

  it("200 — calculates spent, remaining, percentage, and status accurately in batched query mode", async () => {
    const res = await authGet(userA.token, "/api/budgets");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const overall = res.body.data.find((b: { type: string }) => b.type === "OVERALL");
    const category = res.body.data.find((b: { type: string }) => b.type === "CATEGORY");

    // Overall spent should be 150 + 100 = 250.00
    expect(overall.spent).toBe("250.00");
    expect(overall.remaining).toBe("750.00");
    expect(overall.percentage).toBe(25);
    expect(overall.status).toBe("ON_TRACK");

    // Category spent should be 150.00
    expect(category.spent).toBe("150.00");
    expect(category.remaining).toBe("250.00");
    expect(category.percentage).toBe(38);
    expect(category.status).toBe("ON_TRACK");
  });
});
