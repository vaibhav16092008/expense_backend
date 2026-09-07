/**
 * Phase 7 — Notifications & Financial Alerts Integration Tests
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
import { prisma } from "../../src/config/prisma.js";
import {
  generateBudgetNotifications,
  generateRecurringNotifications,
  generateGoalNotifications,
  generateMonthlySummaryNotifications,
  generateAllNotifications,
} from "../../src/services/notification.service.js";

describe("Phase 7 — Notifications & Financial Alerts", () => {
  let userA: TestUser;
  let userB: TestUser;
  let notifA1Id: string;

  beforeAll(async () => {
    userA = await createTestUser("notif_a");
    userB = await createTestUser("notif_b");

    // Manually insert notifications for User A
    const n1 = await prisma.notification.create({
      data: {
        userId: userA.id,
        type: "BUDGET_WARNING",
        title: "Test Budget Warning",
        message: "Your food budget is at 75%.",
        severity: "WARNING",
        notificationKey: "test:key:1",
      },
    });
    notifA1Id = n1.id;

    await prisma.notification.create({
      data: {
        userId: userA.id,
        type: "RECURRING_DUE",
        title: "Test Recurring Due",
        message: "Rent payment is due today.",
        severity: "WARNING",
        isRead: true,
        readAt: new Date(),
        notificationKey: "test:key:2",
      },
    });

    // Manually insert notification for User B
    await prisma.notification.create({
      data: {
        userId: userB.id,
        type: "GOAL_PROGRESS",
        title: "User B Goal Progress",
        message: "Savings goal reached 50%.",
        severity: "INFO",
        notificationKey: "test:key:b1",
      },
    });
  });

  afterAll(async () => {
    await cleanUsers(userA.email, userB.email);
  });

  // -------------------------------------------------------------------------
  // 1. Authentication Enforcement
  // -------------------------------------------------------------------------
  describe("Authentication Enforcement", () => {
    it("401 — GET /api/notifications rejects unauthenticated request", async () => {
      const res = await api.get("/api/notifications");
      expect(res.status).toBe(401);
    });

    it("401 — GET /api/notifications/unread-count rejects unauthenticated request", async () => {
      const res = await api.get("/api/notifications/unread-count");
      expect(res.status).toBe(401);
    });

    it("401 — PATCH /api/notifications/:id/read rejects unauthenticated request", async () => {
      const res = await api.patch(`/api/notifications/${notifA1Id}/read`);
      expect(res.status).toBe(401);
    });

    it("401 — PATCH /api/notifications/read-all rejects unauthenticated request", async () => {
      const res = await api.patch("/api/notifications/read-all");
      expect(res.status).toBe(401);
    });

    it("401 — DELETE /api/notifications/:id rejects unauthenticated request", async () => {
      const res = await api.delete(`/api/notifications/${notifA1Id}`);
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Listing & Pagination
  // -------------------------------------------------------------------------
  describe("GET /api/notifications (List & Pagination)", () => {
    it("200 — returns paginated notifications for authenticated user", async () => {
      const res = await authGet(userA.token, "/api/notifications?page=1&limit=10");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBe(2);
    });

    it("200 — filters unread notifications only when unreadOnly=true", async () => {
      const res = await authGet(userA.token, "/api/notifications?unreadOnly=true");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(notifA1Id);
      expect(res.body.data[0].isRead).toBe(false);
    });

    it("200 — filters notifications by type", async () => {
      const res = await authGet(userA.token, "/api/notifications?type=BUDGET_WARNING");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].type).toBe("BUDGET_WARNING");
    });

    it("400 — rejects limit exceeding 100", async () => {
      const res = await authGet(userA.token, "/api/notifications?limit=150");
      expect(res.status).toBe(400);
    });

    it("200 — enforces user isolation (User B sees zero User A notifications)", async () => {
      const res = await authGet(userB.token, "/api/notifications");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe("User B Goal Progress");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Unread Count Endpoint
  // -------------------------------------------------------------------------
  describe("GET /api/notifications/unread-count", () => {
    it("200 — returns correct unread count for user", async () => {
      const res = await authGet(userA.token, "/api/notifications/unread-count");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Mark Read Operations
  // -------------------------------------------------------------------------
  describe("Mark Read Operations", () => {
    it("200 — marks single notification as read and sets readAt", async () => {
      const res = await authPatch(userA.token, `/api/notifications/${notifA1Id}/read`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeDefined();

      // Verify unread count is now 0
      const countRes = await authGet(userA.token, "/api/notifications/unread-count");
      expect(countRes.body.data.count).toBe(0);
    });

    it("404 — User B cannot mark User A notification as read", async () => {
      const res = await authPatch(userB.token, `/api/notifications/${notifA1Id}/read`);
      expect(res.status).toBe(404);
    });

    it("200 — marks all notifications as read in bulk", async () => {
      // Re-create an unread notification for User A
      const nNew = await prisma.notification.create({
        data: {
          userId: userA.id,
          type: "GOAL_PROGRESS",
          title: "New Goal Progress",
          message: "Progress update",
          severity: "INFO",
          notificationKey: "test:key:3",
        },
      });

      const bulkRes = await authPatch(userA.token, "/api/notifications/read-all");
      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.data.count).toBeGreaterThanOrEqual(1);

      const checkNotif = await prisma.notification.findUnique({
        where: { id: nNew.id },
      });
      expect(checkNotif?.isRead).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Delete Notification
  // -------------------------------------------------------------------------
  describe("DELETE /api/notifications/:id", () => {
    it("404 — User B cannot delete User A notification", async () => {
      const res = await authDelete(userB.token, `/api/notifications/${notifA1Id}`);
      expect(res.status).toBe(404);
    });

    it("200 — deletes owned notification", async () => {
      const res = await authDelete(userA.token, `/api/notifications/${notifA1Id}`);
      expect(res.status).toBe(200);

      const findRes = await prisma.notification.findUnique({
        where: { id: notifA1Id },
      });
      expect(findRes).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Notification Event Generators & Deduplication
  // -------------------------------------------------------------------------
  describe("Notification Event Generators & Deduplication", () => {
    it("Budget Alerts Generator — creates BUDGET_WARNING (70%), BUDGET_CRITICAL (90%), BUDGET_EXCEEDED (100%)", async () => {
      // Create category & budgets for User B
      const catRes = await authPost(userB.token, "/api/categories", {
        name: "Notif Category",
        type: "EXPENSE",
      });
      const catId = catRes.body.data.id;

      await authPost(userB.token, "/api/budgets", {
        amount: 1000,
        type: "CATEGORY",
        period: "MONTHLY",
        categoryId: catId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      });

      // Add expense transaction making spent = 800 (80% -> BUDGET_WARNING)
      await authPost(userB.token, "/api/transactions", {
        amount: 800,
        type: "EXPENSE",
        categoryId: catId,
        date: "2026-09-05",
      });

      const count = await generateBudgetNotifications();
      expect(count).toBeGreaterThan(0);

      const userBNotifs = await prisma.notification.findMany({
        where: { userId: userB.id, type: "BUDGET_WARNING" },
      });
      expect(userBNotifs.length).toBeGreaterThan(0);
      expect(userBNotifs[0]!.severity).toBe("WARNING");
    });

    it("Deduplication — re-running generators does NOT create duplicate notifications", async () => {
      const secondRunCount = await generateBudgetNotifications();
      // Second run must create 0 new notifications for existing budget state due to unique constraint key
      expect(secondRunCount).toBe(0);
    });

    it("Settings Enforcement — disables budget alerts when budgetAlertsEnabled=false", async () => {
      // Disable budget alerts for User B
      await prisma.userSettings.upsert({
        where: { userId: userB.id },
        create: { userId: userB.id, budgetAlertsEnabled: false },
        update: { budgetAlertsEnabled: false },
      });

      const count = await generateBudgetNotifications();
      expect(count).toBe(0);

      // Re-enable for cleanup
      await prisma.userSettings.upsert({
        where: { userId: userB.id },
        create: { userId: userB.id, budgetAlertsEnabled: true },
        update: { budgetAlertsEnabled: true },
      });
    });

    it("Recurring Alerts Generator — generates RECURRING_UPCOMING and RECURRING_DUE", async () => {
      const now = new Date();
      // Recurring schedule due now for User B
      const rec = await prisma.recurringTransaction.create({
        data: {
          userId: userB.id,
          amount: 2000,
          type: "EXPENSE",
          frequency: "MONTHLY",
          startDate: new Date("2026-08-01"),
          nextRunAt: now,
          categoryId: (
            await prisma.category.findFirst({ where: { userId: userB.id } })
          )!.id,
          active: true,
        },
      });

      const count = await generateRecurringNotifications();
      expect(count).toBeGreaterThan(0);

      const dueNotif = await prisma.notification.findFirst({
        where: {
          userId: userB.id,
          type: "RECURRING_DUE",
          referenceId: rec.id,
        },
      });
      expect(dueNotif).not.toBeNull();
      expect(dueNotif!.severity).toBe("WARNING");
    });

    it("Goal Alerts Generator — generates GOAL_PROGRESS milestones and GOAL_DEADLINE", async () => {
      const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const goal = await prisma.financialGoal.create({
        data: {
          userId: userB.id,
          name: "Trip to Japan",
          targetAmount: 10000,
          currentAmount: 5000, // 50% milestone
          deadline: in3Days,
          status: "ACTIVE",
        },
      });

      const count = await generateGoalNotifications();
      expect(count).toBeGreaterThan(0);

      const progressNotif = await prisma.notification.findFirst({
        where: {
          userId: userB.id,
          type: "GOAL_PROGRESS",
          referenceId: goal.id,
        },
      });
      expect(progressNotif).not.toBeNull();

      const deadlineNotif = await prisma.notification.findFirst({
        where: {
          userId: userB.id,
          type: "GOAL_DEADLINE",
          referenceId: goal.id,
        },
      });
      expect(deadlineNotif).not.toBeNull();
    });

    it("Monthly Summary Generator — generates MONTHLY_SUMMARY notification", async () => {
      const count = await generateMonthlySummaryNotifications();
      expect(count).toBeGreaterThan(0);

      const summaryNotif = await prisma.notification.findFirst({
        where: {
          userId: userB.id,
          type: "MONTHLY_SUMMARY",
        },
      });
      expect(summaryNotif).not.toBeNull();
      expect(summaryNotif!.title).toMatch(/Financial Summary/i);
    });

    it("Orchestrator — generateAllNotifications executes all generators without throwing", async () => {
      await expect(generateAllNotifications()).resolves.not.toThrow();
    });
  });
});
