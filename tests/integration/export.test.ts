import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  api,
  createTestUser,
  cleanUsers,
  authPost,
  type TestUser,
} from "../helpers/testHelpers.js";

describe("Phase 4 — CSV Transaction Export", () => {
  let userA: TestUser;
  let userB: TestUser;
  let catAId: string;

  beforeAll(async () => {
    userA = await createTestUser("export_a");
    userB = await createTestUser("export_b");

    // Create Category & Transactions for User A
    const catRes = await authPost(userA.token, "/api/categories", {
      name: "Export Category, Special",
      type: "EXPENSE",
    });
    catAId = catRes.body.data.id;

    await authPost(userA.token, "/api/transactions", {
      amount: 150.5,
      type: "EXPENSE",
      categoryId: catAId,
      note: 'Note with "quotes" and, commas',
      date: "2026-09-01",
    });
  });

  afterAll(async () => {
    await cleanUsers(userA.email, userB.email);
  });

  it("401 — rejects unauthenticated export request", async () => {
    const res = await api.get("/api/transactions/export");
    expect(res.status).toBe(401);
  });

  it("200 — exports user transactions as CSV with correct headers and RFC 4180 escaping", async () => {
    const res = await api
      .get("/api/transactions/export")
      .set("Authorization", `Bearer ${userA.token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/i);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="expenseiq_transactions_/i);

    const csvText = res.text;
    const lines = csvText.split("\r\n").filter((l) => l.trim().length > 0);

    // Header line check
    expect(lines[0]).toBe("ID,Date,Type,Category,Amount,Note");

    // First record line check (verify RFC 4180 escaping of quotes and commas)
    expect(lines[1]).toContain('"Export Category, Special"');
    expect(lines[1]).toContain('150.50');
    expect(lines[1]).toContain('"Note with ""quotes"" and, commas"');
  });

  it("200 — user B cannot export User A transactions (isolation)", async () => {
    const resB = await api
      .get("/api/transactions/export")
      .set("Authorization", `Bearer ${userB.token}`);

    expect(resB.status).toBe(200);
    const lines = resB.text.split("\r\n").filter((l) => l.trim().length > 0);
    // Header only, zero user A transactions
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("ID,Date,Type,Category,Amount,Note");
  });
});
