/**
 * Transaction Integration Tests
 * Tests: GET/POST /api/transactions, GET/PATCH/DELETE /api/transactions/:id
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
let expenseCatId: string;  // userA's EXPENSE category
let incomeCatId: string;   // userA's INCOME category
let bExpenseCatId: string; // userB's EXPENSE category

const DATE = "2026-06-15";

beforeAll(async () => {
  userA = await createTestUser("txn_a");
  userB = await createTestUser("txn_b");

  const expCat = await authPost(userA.token, "/api/categories", { name: "TxnExpense", type: "EXPENSE" });
  expenseCatId = expCat.body.data.id;

  const incCat = await authPost(userA.token, "/api/categories", { name: "TxnIncome", type: "INCOME" });
  incomeCatId = incCat.body.data.id;

  const bCat = await authPost(userB.token, "/api/categories", { name: "BTxnExpense", type: "EXPENSE" });
  bExpenseCatId = bCat.body.data.id;
});

afterAll(async () => {
  await cleanUsers(userA.email, userB.email);
});

// ---------------------------------------------------------------------------
// Create Transaction
// ---------------------------------------------------------------------------

describe("Transactions — POST /api/transactions", () => {
  it("201 — creates expense transaction with all required fields", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50.75,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      amount: "50.75",
      type: "EXPENSE",
      category: { id: expenseCatId, type: "EXPENSE" },
    });
  });

  it("201 — creates income transaction", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 3000,
      type: "INCOME",
      categoryId: incomeCatId,
      date: DATE,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("INCOME");
  });

  it("201 — decimal amount is stored precisely (100.50 → '100.50')", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 100.5,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe("100.50");
  });

  it("201 — decimal string amount is accepted ('999.99')", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: "999.99",
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe("999.99");
  });

  it("201 — optional note is saved", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 25,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
      note: "Lunch expense",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.note).toBe("Lunch expense");
  });

  it("201 — null note is accepted", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 25,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
      note: null,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.note).toBeNull();
  });

  it("400 — mismatched type (INCOME transaction with EXPENSE category) is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "INCOME",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — mismatched type (EXPENSE transaction with INCOME category) is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: incomeCatId,
      date: DATE,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — zero amount is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 0,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — negative amount is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: -50,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — invalid type value is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "SAVINGS",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid date is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: "not-a-date",
    });
    expect(res.status).toBe(400);
  });

  it("400 — missing date is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: expenseCatId,
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid category UUID is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: "not-a-uuid",
      date: DATE,
    });
    expect(res.status).toBe(400);
  });

  it("404 — nonexistent category is rejected", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: "00000000-0000-0000-0000-000000000000",
      date: DATE,
    });
    expect(res.status).toBe(404);
  });

  it("404 — User B's category cannot be used by User A", async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: bExpenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(404);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.post("/api/transactions").send({
      amount: 50,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Get Transaction by ID
// ---------------------------------------------------------------------------

describe("Transactions — GET /api/transactions/:id", () => {
  let txnId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 77.5,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    txnId = res.body.data.id;
  });

  it("200 — returns owned transaction by ID", async () => {
    const res = await authGet(userA.token, `/api/transactions/${txnId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(txnId);
    expect(res.body.data.amount).toBe("77.50");
  });

  it("404 — nonexistent transaction returns 404", async () => {
    const res = await authGet(userA.token, "/api/transactions/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot access User A's transaction", async () => {
    const res = await authGet(userB.token, `/api/transactions/${txnId}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// List Transactions + Filtering
// ---------------------------------------------------------------------------

describe("Transactions — GET /api/transactions", () => {
  let tx1Id: string;

  beforeAll(async () => {
    // Create a set of deterministic transactions for filter tests
    const t1 = await authPost(userA.token, "/api/transactions", {
      amount: 100,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: "2026-03-10",
    });
    tx1Id = t1.body.data.id;

    await authPost(userA.token, "/api/transactions", {
      amount: 200,
      type: "INCOME",
      categoryId: incomeCatId,
      date: "2026-03-15",
    });
  });

  it("200 — returns array of user transactions", async () => {
    const res = await authGet(userA.token, "/api/transactions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("200 — filter by type=EXPENSE returns only EXPENSE transactions", async () => {
    const res = await authGet(userA.token, "/api/transactions?type=EXPENSE");
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { type: string }) => t.type === "EXPENSE")).toBe(true);
  });

  it("200 — filter by type=INCOME returns only INCOME transactions", async () => {
    const res = await authGet(userA.token, "/api/transactions?type=INCOME");
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { type: string }) => t.type === "INCOME")).toBe(true);
  });

  it("200 — filter by categoryId scopes to that category", async () => {
    const res = await authGet(userA.token, `/api/transactions?categoryId=${expenseCatId}`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((t: { category: { id: string } }) => t.category.id === expenseCatId)
    ).toBe(true);
  });

  it("200 — filter by startDate includes only transactions on/after that date", async () => {
    const res = await authGet(userA.token, "/api/transactions?startDate=2026-03-12");
    expect(res.status).toBe(200);
    res.body.data.forEach((t: { date: string }) => {
      expect(new Date(t.date).getTime()).toBeGreaterThanOrEqual(new Date("2026-03-12").getTime());
    });
  });

  it("200 — filter by endDate includes only transactions on/before that date", async () => {
    const res = await authGet(userA.token, "/api/transactions?endDate=2026-03-12");
    expect(res.status).toBe(200);
    res.body.data.forEach((t: { date: string }) => {
      expect(new Date(t.date).getTime()).toBeLessThanOrEqual(
        new Date("2026-03-12T23:59:59.999Z").getTime()
      );
    });
  });

  it("200 — date range filter returns only transactions within the range", async () => {
    const res = await authGet(
      userA.token,
      "/api/transactions?startDate=2026-03-10&endDate=2026-03-10"
    );
    expect(res.status).toBe(200);
    const ids = res.body.data.map((t: { id: string }) => t.id);
    expect(ids).toContain(tx1Id);
  });

  it("200 — transactions belong only to the authenticated user (isolation)", async () => {
    const res = await authGet(userA.token, "/api/transactions");
    const bRes = await authGet(userB.token, "/api/transactions");

    const aIds = res.body.data.map((t: { id: string }) => t.id);
    const bIds = bRes.body.data.map((t: { id: string }) => t.id);
    const overlap = aIds.filter((id: string) => bIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.get("/api/transactions");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Update Transaction
// ---------------------------------------------------------------------------

describe("Transactions — PATCH /api/transactions/:id", () => {
  let txnId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/transactions", {
      amount: 200,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: "2026-05-01",
    });
    txnId = res.body.data.id;
  });

  it("200 — updates amount", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, { amount: 350.25 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe("350.25");
  });

  it("200 — updates date", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, { date: "2026-05-20" });
    expect(res.status).toBe(200);
    expect(new Date(res.body.data.date).getUTCDate()).toBe(20);
  });

  it("200 — updates note", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, { note: "Updated note" });
    expect(res.status).toBe(200);
    expect(res.body.data.note).toBe("Updated note");
  });

  it("200 — sets note to null", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, { note: null });
    expect(res.status).toBe(200);
    expect(res.body.data.note).toBeNull();
  });

  it("400 — changing type to mismatch category is rejected", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, { type: "INCOME" });
    expect(res.status).toBe(400);
  });

  it("400 — zero amount update is rejected", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, { amount: 0 });
    expect(res.status).toBe(400);
  });

  it("400 — empty body is rejected", async () => {
    const res = await authPatch(userA.token, `/api/transactions/${txnId}`, {});
    expect(res.status).toBe(400);
  });

  it("404 — nonexistent transaction returns 404", async () => {
    const res = await authPatch(userA.token, "/api/transactions/00000000-0000-0000-0000-000000000000", { amount: 100 });
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot update User A's transaction", async () => {
    const res = await authPatch(userB.token, `/api/transactions/${txnId}`, { amount: 999 });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Delete Transaction
// ---------------------------------------------------------------------------

describe("Transactions — DELETE /api/transactions/:id", () => {
  it("200 — deletes owned transaction", async () => {
    const created = await authPost(userA.token, "/api/transactions", {
      amount: 15,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    const id = created.body.data.id;

    const res = await authDelete(userA.token, `/api/transactions/${id}`);
    expect(res.status).toBe(200);

    const check = await authGet(userA.token, `/api/transactions/${id}`);
    expect(check.status).toBe(404);
  });

  it("404 — deleting nonexistent transaction returns 404", async () => {
    const res = await authDelete(userA.token, "/api/transactions/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot delete User A's transaction", async () => {
    const created = await authPost(userA.token, "/api/transactions", {
      amount: 15,
      type: "EXPENSE",
      categoryId: expenseCatId,
      date: DATE,
    });
    const res = await authDelete(userB.token, `/api/transactions/${created.body.data.id}`);
    expect(res.status).toBe(404);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.delete("/api/transactions/some-id");
    expect(res.status).toBe(401);
  });
});
