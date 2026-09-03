/**
 * Recurring Transaction Integration Tests
 * Tests: CRUD, pause/resume, processing, idempotency, monthly/yearly edge cases
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
let expCatId: string;
let incCatId: string;
let bExpCatId: string;

beforeAll(async () => {
  userA = await createTestUser("rec_a");
  userB = await createTestUser("rec_b");

  const expCat = await authPost(userA.token, "/api/categories", { name: "RecExpense", type: "EXPENSE" });
  expCatId = expCat.body.data.id;

  const incCat = await authPost(userA.token, "/api/categories", { name: "RecIncome", type: "INCOME" });
  incCatId = incCat.body.data.id;

  const bCat = await authPost(userB.token, "/api/categories", { name: "BRecExpense", type: "EXPENSE" });
  bExpCatId = bCat.body.data.id;
});

afterAll(async () => {
  await cleanUsers(userA.email, userB.email);
});

// ---------------------------------------------------------------------------
// Create Recurring Transaction
// ---------------------------------------------------------------------------

describe("Recurring — POST /api/recurring-transactions", () => {
  it("201 — creates DAILY recurring transaction", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      amount: "10.00",
      type: "EXPENSE",
      frequency: "DAILY",
      active: true,
    });
    expect(res.body.data.category.id).toBe(expCatId);
  });

  it("201 — creates WEEKLY recurring transaction", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "WEEKLY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe("WEEKLY");
  });

  it("201 — creates MONTHLY recurring transaction", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 1000,
      type: "INCOME",
      categoryId: incCatId,
      frequency: "MONTHLY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe("MONTHLY");
    expect(res.body.data.type).toBe("INCOME");
  });

  it("201 — creates YEARLY recurring transaction", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 1200,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "YEARLY",
      startDate: "2026-01-01",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe("YEARLY");
  });

  it("201 — optional note and endDate are accepted", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 25,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      note: "Daily coffee",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.note).toBe("Daily coffee");
    expect(res.body.data.endDate).not.toBeNull();
  });

  it("201 — nextRunAt is set to startDate on creation", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 5,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-08-01",
    });
    expect(res.status).toBe(201);
    const nextRunAt = new Date(res.body.data.nextRunAt);
    expect(nextRunAt.getUTCDate()).toBe(1);
    expect(nextRunAt.getUTCMonth()).toBe(7); // August (0-indexed)
  });

  it("400 — mismatched type (INCOME with EXPENSE category) is rejected", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 50,
      type: "INCOME",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(400);
  });

  it("400 — invalid frequency is rejected", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 50,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "HOURLY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(400);
  });

  it("400 — zero amount is rejected", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 0,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(400);
  });

  it("400 — endDate before startDate is rejected", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-06-30",
      endDate: "2026-06-01",
    });
    expect(res.status).toBe(400);
  });

  it("404 — nonexistent categoryId is rejected", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: "00000000-0000-0000-0000-000000000000",
      frequency: "DAILY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(404);
  });

  it("404 — User B's category cannot be used by User A", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: bExpCatId,
      frequency: "DAILY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(404);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.post("/api/recurring-transactions").send({
      amount: 10,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-06-01",
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// List Recurring Transactions
// ---------------------------------------------------------------------------

describe("Recurring — GET /api/recurring-transactions", () => {
  it("200 — returns array of user's recurring transactions", async () => {
    const res = await authGet(userA.token, "/api/recurring-transactions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("200 — filter by active=true returns only active schedules", async () => {
    const res = await authGet(userA.token, "/api/recurring-transactions?active=true");
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { active: boolean }) => r.active === true)).toBe(true);
  });

  it("200 — filter by frequency=DAILY returns only DAILY schedules", async () => {
    const res = await authGet(userA.token, "/api/recurring-transactions?frequency=DAILY");
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { frequency: string }) => r.frequency === "DAILY")).toBe(true);
  });

  it("200 — User B cannot see User A's recurring transactions", async () => {
    const resA = await authGet(userA.token, "/api/recurring-transactions");
    const resB = await authGet(userB.token, "/api/recurring-transactions");
    const aIds = resA.body.data.map((r: { id: string }) => r.id);
    const bIds = resB.body.data.map((r: { id: string }) => r.id);
    const overlap = aIds.filter((id: string) => bIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.get("/api/recurring-transactions");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

describe("Recurring — GET /api/recurring-transactions/:id", () => {
  let recId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 30,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "WEEKLY",
      startDate: "2026-09-01",
    });
    recId = res.body.data.id;
  });

  it("200 — returns owned recurring transaction by ID", async () => {
    const res = await authGet(userA.token, `/api/recurring-transactions/${recId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(recId);
  });

  it("404 — nonexistent ID returns 404", async () => {
    const res = await authGet(userA.token, "/api/recurring-transactions/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot get User A's recurring transaction", async () => {
    const res = await authGet(userB.token, `/api/recurring-transactions/${recId}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Update Recurring Transaction
// ---------------------------------------------------------------------------

describe("Recurring — PATCH /api/recurring-transactions/:id", () => {
  let recId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 100,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "MONTHLY",
      startDate: "2026-10-01",
    });
    recId = res.body.data.id;
  });

  it("200 — updates amount", async () => {
    const res = await authPatch(userA.token, `/api/recurring-transactions/${recId}`, { amount: 150 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe("150.00");
  });

  it("200 — updates note", async () => {
    const res = await authPatch(userA.token, `/api/recurring-transactions/${recId}`, { note: "Updated note" });
    expect(res.status).toBe(200);
    expect(res.body.data.note).toBe("Updated note");
  });

  it("200 — updates frequency", async () => {
    const res = await authPatch(userA.token, `/api/recurring-transactions/${recId}`, { frequency: "WEEKLY" });
    expect(res.status).toBe(200);
    expect(res.body.data.frequency).toBe("WEEKLY");
  });

  it("400 — empty body is rejected", async () => {
    const res = await authPatch(userA.token, `/api/recurring-transactions/${recId}`, {});
    expect(res.status).toBe(400);
  });

  it("404 — updating nonexistent recurring returns 404", async () => {
    const res = await authPatch(userA.token, "/api/recurring-transactions/00000000-0000-0000-0000-000000000000", { amount: 50 });
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot update User A's recurring transaction", async () => {
    const res = await authPatch(userB.token, `/api/recurring-transactions/${recId}`, { amount: 9999 });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Pause / Resume
// ---------------------------------------------------------------------------

describe("Recurring — Pause & Resume", () => {
  let recId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 40,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-11-01",
    });
    recId = res.body.data.id;
  });

  it("200 — pause active recurring transaction → active=false", async () => {
    const res = await authPost(userA.token, `/api/recurring-transactions/${recId}/pause`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it("200 — resume paused recurring transaction → active=true", async () => {
    const res = await authPost(userA.token, `/api/recurring-transactions/${recId}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(true);
  });

  it("404 — User B cannot pause User A's recurring transaction", async () => {
    const res = await authPost(userB.token, `/api/recurring-transactions/${recId}/pause`);
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot resume User A's recurring transaction", async () => {
    const res = await authPost(userB.token, `/api/recurring-transactions/${recId}/resume`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

describe("Recurring — DELETE /api/recurring-transactions/:id", () => {
  it("200 — deletes owned recurring schedule", async () => {
    const created = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 5,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2026-12-01",
    });
    const id = created.body.data.id;
    const res = await authDelete(userA.token, `/api/recurring-transactions/${id}`);
    expect(res.status).toBe(200);

    const check = await authGet(userA.token, `/api/recurring-transactions/${id}`);
    expect(check.status).toBe(404);
  });

  it("404 — deleting nonexistent recurring transaction returns 404", async () => {
    const res = await authDelete(userA.token, "/api/recurring-transactions/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot delete User A's recurring transaction", async () => {
    const created = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 5,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "DAILY",
      startDate: "2025-01-01",
    });
    const res = await authDelete(userB.token, `/api/recurring-transactions/${created.body.data.id}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Processing — POST /api/recurring-transactions/process
// ---------------------------------------------------------------------------

describe("Recurring — POST /api/recurring-transactions/process", () => {
  it("200 — process endpoint returns summary with expected fields", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions/process");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const d = res.body.data;
    expect(d).toHaveProperty("processedSchedules");
    expect(d).toHaveProperty("generatedTransactions");
    expect(d).toHaveProperty("skippedDuplicates");
    expect(d).toHaveProperty("deactivatedSchedules");
  });

  it("idempotency — processing twice does not generate duplicate transactions", async () => {
    const pastStart = "2024-01-01";
    const freshUser = await createTestUser("rec_idem");
    try {
      const cat = await authPost(freshUser.token, "/api/categories", { name: "IdemCat", type: "EXPENSE" });
      const catId = cat.body.data.id;

      await authPost(freshUser.token, "/api/recurring-transactions", {
        amount: 10,
        type: "EXPENSE",
        categoryId: catId,
        frequency: "MONTHLY",
        startDate: pastStart,
        endDate: "2030-01-01", // Far future end date so schedule stays active
      });

      // Process first time (generates transactions up to today)
      const r1 = await authPost(freshUser.token, "/api/recurring-transactions/process");
      expect(r1.status).toBe(200);
      const gen1 = r1.body.data.generatedTransactions;
      expect(gen1).toBeGreaterThanOrEqual(1);

      // Process second time immediately (all due occurrences were already generated)
      const r2 = await authPost(freshUser.token, "/api/recurring-transactions/process");
      expect(r2.status).toBe(200);
      const gen2 = r2.body.data.generatedTransactions;

      // Second run must generate 0 new transactions
      expect(gen2).toBe(0);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("paused recurring transaction is not processed", async () => {
    const freshUser = await createTestUser("rec_pause_proc");
    try {
      const cat = await authPost(freshUser.token, "/api/categories", { name: "PausedCat", type: "EXPENSE" });
      const catId = cat.body.data.id;

      const rec = await authPost(freshUser.token, "/api/recurring-transactions", {
        amount: 10,
        type: "EXPENSE",
        categoryId: catId,
        frequency: "DAILY",
        startDate: "2024-01-01",
      });
      const recId = rec.body.data.id;

      // Pause it
      await authPost(freshUser.token, `/api/recurring-transactions/${recId}/pause`);

      // Process — paused should not generate
      const r = await authPost(freshUser.token, "/api/recurring-transactions/process");
      expect(r.status).toBe(200);
      expect(r.body.data.generatedTransactions).toBe(0);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("past-dated recurring transaction generates transactions on process", async () => {
    const freshUser = await createTestUser("rec_gen");
    try {
      const cat = await authPost(freshUser.token, "/api/categories", { name: "GenCat", type: "EXPENSE" });
      const catId = cat.body.data.id;

      const twoDaysAgo = new Date();
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
      const startDate = twoDaysAgo.toISOString().split("T")[0];

      await authPost(freshUser.token, "/api/recurring-transactions", {
        amount: 10,
        type: "EXPENSE",
        categoryId: catId,
        frequency: "DAILY",
        startDate,
        endDate: startDate,
      });

      const r = await authPost(freshUser.token, "/api/recurring-transactions/process");
      expect(r.status).toBe(200);
      expect(r.body.data.generatedTransactions).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("401 — unauthenticated process request is rejected", async () => {
    const res = await api.post("/api/recurring-transactions/process");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Monthly Edge Cases — next occurrence calculation
// ---------------------------------------------------------------------------

describe("Recurring — Monthly anchor day edge cases", () => {
  it("schedule starting on Jan 31 → nextRunAt set to Jan 31", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "MONTHLY",
      startDate: "2024-01-31",
    });
    expect(res.status).toBe(201);
    const nextRun = new Date(res.body.data.nextRunAt);
    expect(nextRun.getUTCDate()).toBe(31);
    expect(nextRun.getUTCMonth()).toBe(0); // January
  });

  it("schedule starting on March 31 is created successfully (MONTHLY)", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "MONTHLY",
      startDate: "2024-03-31",
    });
    expect(res.status).toBe(201);
    const nextRun = new Date(res.body.data.nextRunAt);
    expect(nextRun.getUTCDate()).toBe(31);
  });

  it("schedule starting on Feb 29 (leap year 2024) is created successfully", async () => {
    const res = await authPost(userA.token, "/api/recurring-transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: expCatId,
      frequency: "YEARLY",
      startDate: "2024-02-29",
    });
    expect(res.status).toBe(201);
    const nextRun = new Date(res.body.data.nextRunAt);
    expect(nextRun.getUTCMonth()).toBe(1); // February
    expect(nextRun.getUTCDate()).toBe(29);
  });
});
