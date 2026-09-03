/**
 * Category Integration Tests
 * Tests: GET/POST /api/categories, GET/PATCH/DELETE /api/categories/:id
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

beforeAll(async () => {
  userA = await createTestUser("cat_a");
  userB = await createTestUser("cat_b");
});

afterAll(async () => {
  await cleanUsers(userA.email, userB.email);
});

// ---------------------------------------------------------------------------
// Create Category
// ---------------------------------------------------------------------------

describe("Categories — POST /api/categories", () => {
  it("201 — creates EXPENSE category and returns all fields", async () => {
    const res = await authPost(userA.token, "/api/categories", {
      name: "Groceries",
      type: "EXPENSE",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      name: "Groceries",
      type: "EXPENSE",
      userId: userA.id,
    });
  });

  it("201 — creates INCOME category successfully", async () => {
    const res = await authPost(userA.token, "/api/categories", {
      name: "Salary",
      type: "INCOME",
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Salary", type: "INCOME" });
  });

  it("201 — name is trimmed before saving", async () => {
    const res = await authPost(userA.token, "/api/categories", {
      name: "  Transport  ",
      type: "EXPENSE",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Transport");
  });

  it("409 — duplicate (same name + same type) is rejected", async () => {
    const name = `Dup_${Date.now()}`;
    await authPost(userA.token, "/api/categories", { name, type: "EXPENSE" });
    const res = await authPost(userA.token, "/api/categories", { name, type: "EXPENSE" });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("201 — same name but different type is allowed (EXPENSE vs INCOME)", async () => {
    const name = `Mixed_${Date.now()}`;
    await authPost(userA.token, "/api/categories", { name, type: "EXPENSE" });
    const res = await authPost(userA.token, "/api/categories", { name, type: "INCOME" });
    expect(res.status).toBe(201);
  });

  it("400 — missing name is rejected", async () => {
    const res = await authPost(userA.token, "/api/categories", { type: "EXPENSE" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — missing type is rejected", async () => {
    const res = await authPost(userA.token, "/api/categories", { name: "Misc" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — invalid type value is rejected", async () => {
    const res = await authPost(userA.token, "/api/categories", { name: "Misc", type: "SAVINGS" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — name shorter than 2 characters is rejected", async () => {
    const res = await authPost(userA.token, "/api/categories", { name: "A", type: "EXPENSE" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — name longer than 50 characters is rejected", async () => {
    const res = await authPost(userA.token, "/api/categories", {
      name: "A".repeat(51),
      type: "EXPENSE",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.post("/api/categories").send({ name: "Food", type: "EXPENSE" });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// List Categories
// ---------------------------------------------------------------------------

describe("Categories — GET /api/categories", () => {
  it("200 — returns user's categories as array", async () => {
    const res = await authGet(userA.token, "/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("200 — returns empty array for new user with no categories", async () => {
    const freshUser = await createTestUser("cat_empty");
    try {
      const res = await authGet(freshUser.token, "/api/categories");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("200 — can filter by type=EXPENSE", async () => {
    const freshUser = await createTestUser("cat_filter");
    try {
      await authPost(freshUser.token, "/api/categories", { name: "Food", type: "EXPENSE" });
      await authPost(freshUser.token, "/api/categories", { name: "Wage", type: "INCOME" });

      const res = await authGet(freshUser.token, "/api/categories?type=EXPENSE");
      expect(res.status).toBe(200);
      expect(res.body.data.every((c: { type: string }) => c.type === "EXPENSE")).toBe(true);
    } finally {
      await cleanUsers(freshUser.email);
    }
  });

  it("200 — user A's categories are not visible to user B", async () => {
    await authPost(userA.token, "/api/categories", { name: `Private_${Date.now()}`, type: "EXPENSE" });

    const resA = await authGet(userA.token, "/api/categories");
    const resB = await authGet(userB.token, "/api/categories");

    const aIds = resA.body.data.map((c: { id: string }) => c.id);
    const bIds = resB.body.data.map((c: { id: string }) => c.id);

    // No overlap
    const overlap = aIds.filter((id: string) => bIds.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.get("/api/categories");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Get by ID
// ---------------------------------------------------------------------------

describe("Categories — GET /api/categories/:id", () => {
  it("200 — returns a specific owned category by ID", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: "GetById", type: "EXPENSE" });
    const id = created.body.data.id;

    const res = await authGet(userA.token, `/api/categories/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it("404 — nonexistent category returns 404", async () => {
    const res = await authGet(userA.token, "/api/categories/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot access User A's category", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: "OwnerOnly", type: "EXPENSE" });
    const id = created.body.data.id;

    const res = await authGet(userB.token, `/api/categories/${id}`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Update Category
// ---------------------------------------------------------------------------

describe("Categories — PATCH /api/categories/:id", () => {
  it("200 — updates category name", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: "OldName", type: "EXPENSE" });
    const id = created.body.data.id;

    const res = await authPatch(userA.token, `/api/categories/${id}`, { name: "NewName" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("NewName");
  });

  it("200 — updates category type", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: `TypeFlip_${Date.now()}`, type: "EXPENSE" });
    const id = created.body.data.id;

    const res = await authPatch(userA.token, `/api/categories/${id}`, { type: "INCOME" });
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe("INCOME");
  });

  it("409 — updating to an existing name+type causes conflict", async () => {
    const name = `ConflictUpd_${Date.now()}`;
    await authPost(userA.token, "/api/categories", { name, type: "EXPENSE" });
    const cat2 = await authPost(userA.token, "/api/categories", { name: `Other_${Date.now()}`, type: "EXPENSE" });
    const id2 = cat2.body.data.id;

    const res = await authPatch(userA.token, `/api/categories/${id2}`, { name });
    expect(res.status).toBe(409);
  });

  it("400 — empty body is rejected (at least one field required)", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: "EmptyPatch", type: "EXPENSE" });
    const res = await authPatch(userA.token, `/api/categories/${created.body.data.id}`, {});
    expect(res.status).toBe(400);
  });

  it("404 — updating nonexistent category returns 404", async () => {
    const res = await authPatch(userA.token, "/api/categories/00000000-0000-0000-0000-000000000000", { name: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot update User A's category", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: "SecureUpdate", type: "EXPENSE" });
    const res = await authPatch(userB.token, `/api/categories/${created.body.data.id}`, { name: "Hacked" });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Delete Category
// ---------------------------------------------------------------------------

describe("Categories — DELETE /api/categories/:id", () => {
  it("200 — deletes an unreferenced owned category", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: `DeleteMe_${Date.now()}`, type: "EXPENSE" });
    const id = created.body.data.id;

    const res = await authDelete(userA.token, `/api/categories/${id}`);
    expect(res.status).toBe(200);

    // Confirm it is gone
    const check = await authGet(userA.token, `/api/categories/${id}`);
    expect(check.status).toBe(404);
  });

  it("404 — deleting nonexistent category returns 404", async () => {
    const res = await authDelete(userA.token, "/api/categories/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("404 — User B cannot delete User A's category", async () => {
    const created = await authPost(userA.token, "/api/categories", { name: `SecureDel_${Date.now()}`, type: "EXPENSE" });
    const res = await authDelete(userB.token, `/api/categories/${created.body.data.id}`);
    expect(res.status).toBe(404);
  });

  it("409 — category referenced by a transaction cannot be deleted", async () => {
    // Create a category and attach a transaction to it
    const catRes = await authPost(userA.token, "/api/categories", { name: `RefCat_${Date.now()}`, type: "EXPENSE" });
    const catId = catRes.body.data.id;

    await authPost(userA.token, "/api/transactions", {
      amount: 10,
      type: "EXPENSE",
      categoryId: catId,
      date: "2026-01-15",
    });

    const res = await authDelete(userA.token, `/api/categories/${catId}`);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.delete("/api/categories/some-id");
    expect(res.status).toBe(401);
  });
});
