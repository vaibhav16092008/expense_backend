import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  cleanUsers,
  authPost,
  type TestUser,
} from "../helpers/testHelpers.js";
import { runRecurringJob } from "../../src/jobs/recurringCron.js";
import { prisma } from "../../src/config/prisma.js";

describe("Phase 4 — Recurring Transaction Cron & Idempotency", () => {
  let userA: TestUser;
  let catId: string;

  beforeAll(async () => {
    userA = await createTestUser("cron_a");

    const catRes = await authPost(userA.token, "/api/categories", {
      name: "Cron Category",
      type: "EXPENSE",
    });
    catId = catRes.body.data.id;

    // Create due recurring transaction starting 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await authPost(userA.token, "/api/recurring-transactions", {
      amount: 45.0,
      type: "EXPENSE",
      categoryId: catId,
      frequency: "DAILY",
      startDate: twoDaysAgo,
      note: "Cron test schedule",
    });
  });

  afterAll(async () => {
    await cleanUsers(userA.email);
  });

  it("executes recurring job and generates due transactions idempotently", async () => {
    // Execute cron job runner directly
    await runRecurringJob();

    // Verify transactions were generated in DB
    const txnsFirstRun = await prisma.transaction.findMany({
      where: { userId: userA.id },
    });
    expect(txnsFirstRun.length).toBeGreaterThan(0);

    const firstCount = txnsFirstRun.length;

    // Execute cron job runner second time immediately -> idempotency check (0 duplicates)
    await runRecurringJob();

    const txnsSecondRun = await prisma.transaction.findMany({
      where: { userId: userA.id },
    });
    expect(txnsSecondRun.length).toBe(firstCount);
  });
});
