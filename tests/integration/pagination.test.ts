import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  api,
  createTestUser,
  cleanUsers,
  authGet,
  authPost,
  type TestUser,
} from "../helpers/testHelpers.js";

describe("Phase 4 — Standardized Pagination", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser("page_a");
    userB = await createTestUser("page_b");
  });

  afterAll(async () => {
    await cleanUsers(userA.email, userB.email);
  });

  // -------------------------------------------------------------------------
  // 1. Transactions Pagination
  // -------------------------------------------------------------------------
  describe("Transactions Pagination", () => {
    it("200 — returns default pagination envelope (page=1, limit=20)", async () => {
      const res = await authGet(userA.token, "/api/transactions");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
      expect(typeof res.body.pagination.totalCount).toBe("number");
      expect(typeof res.body.pagination.totalPages).toBe("number");
      expect(typeof res.body.pagination.hasMore).toBe("boolean");
    });

    it("200 — custom page and limit parameters work correctly", async () => {
      const res = await authGet(userA.token, "/api/transactions?page=1&limit=5");

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it("400 — invalid page=0 is rejected", async () => {
      const res = await authGet(userA.token, "/api/transactions?page=0");
      expect(res.status).toBe(400);
    });

    it("400 — invalid negative limit is rejected", async () => {
      const res = await authGet(userA.token, "/api/transactions?limit=-10");
      expect(res.status).toBe(400);
    });

    it("400 — limit exceeding 100 is rejected", async () => {
      const res = await authGet(userA.token, "/api/transactions?limit=150");
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Categories Pagination
  // -------------------------------------------------------------------------
  describe("Categories Pagination", () => {
    it("200 — returns paginated categories", async () => {
      const res = await authGet(userA.token, "/api/categories?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("400 — limit > 100 on categories returns 400", async () => {
      const res = await authGet(userA.token, "/api/categories?limit=200");
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Recurring Transactions Pagination
  // -------------------------------------------------------------------------
  describe("Recurring Transactions Pagination", () => {
    it("200 — returns paginated recurring transaction schedules", async () => {
      const res = await authGet(userA.token, "/api/recurring-transactions?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Financial Goals Pagination
  // -------------------------------------------------------------------------
  describe("Goals Pagination", () => {
    it("200 — returns paginated financial goals", async () => {
      const res = await authGet(userA.token, "/api/goals?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
