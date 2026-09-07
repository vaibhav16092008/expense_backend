import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  api,
  createTestUser,
  cleanUsers,
  authPost,
  authGet,
  type TestUser,
} from "../helpers/testHelpers.js";

describe("Phase 6 — Advanced Export & Data Portability", () => {
  let userA: TestUser;
  let userB: TestUser;
  let catAId: string;
  let catBId: string;

  beforeAll(async () => {
    userA = await createTestUser("exp_phase6_a");
    userB = await createTestUser("exp_phase6_b");

    // Categories
    const catARes = await authPost(userA.token, "/api/categories", {
      name: "Export Category, Special",
      type: "EXPENSE",
    });
    catAId = catARes.body.data.id;

    const catBRes = await authPost(userB.token, "/api/categories", {
      name: "UserB Category",
      type: "EXPENSE",
    });
    catBId = catBRes.body.data.id;

    // Transactions for User A
    await authPost(userA.token, "/api/transactions", {
      amount: 150.5,
      type: "EXPENSE",
      categoryId: catAId,
      note: 'Note with "quotes" and, commas',
      date: "2026-09-01",
    });

    await authPost(userA.token, "/api/transactions", {
      amount: 5000,
      type: "INCOME",
      categoryId: (
        await authPost(userA.token, "/api/categories", {
          name: "Salary",
          type: "INCOME",
        })
      ).body.data.id,
      date: "2026-09-02",
    });

    // Transactions for User B
    await authPost(userB.token, "/api/transactions", {
      amount: 999,
      type: "EXPENSE",
      categoryId: catBId,
      date: "2026-09-01",
    });

    // Budget for User A
    await authPost(userA.token, "/api/budgets", {
      amount: 1000,
      type: "CATEGORY",
      period: "MONTHLY",
      categoryId: catAId,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });

    // Goal for User A
    await authPost(userA.token, "/api/goals", {
      name: "Emergency Fund",
      targetAmount: 50000,
    });
  });

  afterAll(async () => {
    await cleanUsers(userA.email, userB.email);
  });

  // -------------------------------------------------------------------------
  // 1. Backward Compatibility & Transaction CSV Export
  // -------------------------------------------------------------------------
  describe("Transaction CSV Export & Backward Compatibility", () => {
    it("401 — rejects unauthenticated export request on legacy endpoint", async () => {
      const res = await api.get("/api/transactions/export");
      expect(res.status).toBe(401);
    });

    it("401 — rejects unauthenticated export request on new endpoint", async () => {
      const res = await api.get("/api/exports/transactions");
      expect(res.status).toBe(401);
    });

    it("200 — exports user transactions as CSV via legacy route (/api/transactions/export)", async () => {
      const res = await api
        .get("/api/transactions/export")
        .set("Authorization", `Bearer ${userA.token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/i);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="expenseiq_transactions_/i
      );

      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe("ID,Date,Type,Category,Amount,Note");
      expect(res.text).toContain('"Export Category, Special"');
      expect(res.text).toContain("150.50");
      expect(res.text).toContain('"Note with ""quotes"" and, commas"');
    });

    it("200 — exports user transactions as CSV via new route (/api/exports/transactions)", async () => {
      const res = await authGet(userA.token, "/api/exports/transactions");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/i);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="expenseiq_transactions_/i
      );
      expect(res.headers["cache-control"]).toMatch(/no-store/i);

      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe("ID,Date,Type,Category,Amount,Note");
      expect(lines.length).toBeGreaterThan(1);
    });

    it("200 — supports date, type, and category filtering on /api/exports/transactions", async () => {
      const res = await authGet(
        userA.token,
        `/api/exports/transactions?from=2026-09-01&to=2026-09-01&type=EXPENSE&categoryId=${catAId}`
      );

      expect(res.status).toBe(200);
      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(2); // Header + 1 transaction
      expect(lines[1]).toContain("150.50");
    });

    it("400 — rejects invalid date format or non-existent calendar date", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/transactions?from=2026-02-30&to=2026-09-30"
      );
      expect(res.status).toBe(400);
    });

    it("400 — rejects when from > to", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/transactions?from=2026-09-30&to=2026-09-01"
      );
      expect(res.status).toBe(400);
    });

    it("200 — user B sees zero user A transactions (user isolation)", async () => {
      const res = await authGet(userB.token, "/api/exports/transactions");
      expect(res.status).toBe(200);
      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(2); // Header + User B's 1 transaction
      expect(lines[1]).not.toContain('"Export Category, Special"');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Report CSV Export
  // -------------------------------------------------------------------------
  describe("Report CSV Export (/api/exports/reports)", () => {
    it("401 — rejects unauthenticated request", async () => {
      const res = await api.get(
        "/api/exports/reports?type=summary&from=2026-09-01&to=2026-09-30"
      );
      expect(res.status).toBe(401);
    });

    it("200 — exports Summary report as CSV with exact values matching report service", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=summary&from=2026-09-01&to=2026-09-30"
      );

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/i);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="expenseiq_report_summary_/i
      );

      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe("Metric,Value");
      expect(lines).toContain("Total Income,5000.00");
      expect(lines).toContain("Total Expense,150.50");
    });

    it("200 — exports Cash Flow report as CSV with period breakdown", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=cash-flow&from=2026-09-01&to=2026-09-30&groupBy=month"
      );

      expect(res.status).toBe(200);
      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe("Period,Income,Expense,Net");
      expect(lines[1]).toContain("2026-09");
      expect(lines[1]).toContain("5000.00");
      expect(lines[1]).toContain("150.50");
    });

    it("200 — exports Categories report as CSV", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=categories&from=2026-09-01&to=2026-09-30"
      );

      expect(res.status).toBe(200);
      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe("Category,Amount,Percentage");
      expect(lines[1]).toContain('"Export Category, Special"');
      expect(lines[1]).toContain("150.50");
      expect(lines[1]).toContain("100.00");
    });

    it("200 — exports Budgets report as CSV", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=budgets&from=2026-09-01&to=2026-09-30"
      );

      expect(res.status).toBe(200);
      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe(
        "Budget,Type,Period,Start Date,End Date,Amount,Spent,Remaining,Percentage,Status"
      );
      expect(lines[1]).toContain('"Export Category, Special"');
      expect(lines[1]).toContain("CATEGORY");
      expect(lines[1]).toContain("MONTHLY");
      expect(lines[1]).toContain("1000.00");
      expect(lines[1]).toContain("150.50");
      expect(lines[1]).toContain("ON_TRACK");
    });

    it("200 — exports Savings report as CSV", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=savings&from=2026-09-01&to=2026-09-30&groupBy=month"
      );

      expect(res.status).toBe(200);
      const lines = res.text.split("\r\n").filter((l) => l.trim().length > 0);
      expect(lines[0]).toBe("Period,Income,Expense,Savings,Savings Rate");
      expect(lines[1]).toContain("2026-09");
      expect(lines[1]).toContain("5000.00");
      expect(lines[1]).toContain("150.50");
      expect(lines[1]).toContain("4849.50");
    });

    it("400 — rejects missing required report parameters (missing type)", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?from=2026-09-01&to=2026-09-30"
      );
      expect(res.status).toBe(400);
    });

    it("400 — rejects invalid report type", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=invalid&from=2026-09-01&to=2026-09-30"
      );
      expect(res.status).toBe(400);
    });

    it("400 — rejects groupBy when passed for unsupported report type (summary)", async () => {
      const res = await authGet(
        userA.token,
        "/api/exports/reports?type=summary&from=2026-09-01&to=2026-09-30&groupBy=month"
      );
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Complete Financial JSON Export
  // -------------------------------------------------------------------------
  describe("Complete Financial JSON Export (/api/exports/financial)", () => {
    it("401 — rejects unauthenticated request", async () => {
      const res = await api.get("/api/exports/financial");
      expect(res.status).toBe(401);
    });

    it("200 — returns versioned financial data structure containing user records", async () => {
      const res = await authGet(userA.token, "/api/exports/financial");

      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toMatch(/no-store/i);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      expect(d).toHaveProperty("metadata");
      expect(d.metadata.application).toBe("ExpenseIQ");
      expect(d.metadata.version).toBe("1");
      expect(d.metadata).toHaveProperty("exportedAt");

      expect(d).toHaveProperty("profile");
      expect(d.profile.email).toBe(userA.email);

      expect(d).toHaveProperty("settings");
      expect(d).toHaveProperty("categories");
      expect(d.categories.length).toBeGreaterThan(0);

      expect(d).toHaveProperty("transactions");
      expect(d.transactions.length).toBeGreaterThan(0);

      expect(d).toHaveProperty("budgets");
      expect(d.budgets.length).toBeGreaterThan(0);

      expect(d).toHaveProperty("recurringTransactions");
      expect(d).toHaveProperty("goals");
      expect(d.goals.length).toBeGreaterThan(0);

      expect(d).toHaveProperty("goalContributions");
    });

    it("200 — enforces user isolation (User B export contains zero User A records)", async () => {
      const res = await authGet(userB.token, "/api/exports/financial");

      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.profile.email).toBe(userB.email);

      const userACats = d.categories.filter(
        (c: { name: string }) => c.name === "Export Category, Special"
      );
      expect(userACats).toHaveLength(0);
    });

    it("SECURITY CHECK — strictly excludes sensitive authentication and session secrets", async () => {
      const res = await authGet(userA.token, "/api/exports/financial");
      expect(res.status).toBe(200);

      const jsonString = JSON.stringify(res.body);

      // Assert password / passwordHash / session tokens / hashes are NEVER present
      expect(res.body.data.profile).not.toHaveProperty("password");
      expect(res.body.data.profile).not.toHaveProperty("passwordHash");
      expect(res.body.data).not.toHaveProperty("sessions");
      expect(res.body.data).not.toHaveProperty("userSessions");

      expect(jsonString).not.toContain("currentTokenHash");
      expect(jsonString).not.toContain("previousTokenHash");
      expect(jsonString).not.toContain("refreshToken");
    });
  });
});
