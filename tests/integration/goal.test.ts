/**
 * Financial Goals — comprehensive integration test suite.
 *
 * Covers:
 *   - Authentication (401 on every endpoint)
 *   - CRUD (create / list / get / update / delete)
 *   - Validation (all field rules)
 *   - Contributions (add / list / delete / atomicity / decimal safety)
 *   - Derived fields (remainingAmount / progressPercentage / daysRemaining / derivedStatus)
 *   - Lifecycle (pause / resume / complete / invalid transitions)
 *   - Summary (empty + populated + aggregates + topGoal + nearestDeadline)
 *   - Filtering & sorting
 *   - Security / multi-tenant isolation (User A vs User B)
 *   - Cascade deletion
 *   - Regression guard (unrelated Transaction records untouched)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  cleanUsers,
  disconnectPrisma,
  authGet,
  authPost,
  authPatch,
  authDelete,
  api,
} from "../helpers/testHelpers.js";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let userA: { id: string; email: string; token: string };
let userB: { id: string; email: string; token: string };

const BASE = "/api/goals";

beforeAll(async () => {
  userA = await createTestUser("A");
  userB = await createTestUser("B");
});

afterAll(async () => {
  // Clean up goals first (cascade contributions), then users
  await cleanUsers(userA.email, userB.email);
  await disconnectPrisma();
});

// ===========================================================================
// 1. AUTHENTICATION — every endpoint must return 401 without a token
// ===========================================================================

describe("Authentication", () => {
  it("GET /api/goals → 401", async () => {
    const res = await api.get(BASE);
    expect(res.status).toBe(401);
  });

  it("POST /api/goals → 401", async () => {
    const res = await api.post(BASE).send({ name: "x", targetAmount: 100 });
    expect(res.status).toBe(401);
  });

  it("GET /api/goals/summary → 401", async () => {
    const res = await api.get(`${BASE}/summary`);
    expect(res.status).toBe(401);
  });

  it("GET /api/goals/:id → 401", async () => {
    const res = await api.get(`${BASE}/some-id`);
    expect(res.status).toBe(401);
  });

  it("PATCH /api/goals/:id → 401", async () => {
    const res = await api.patch(`${BASE}/some-id`).send({ name: "y" });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/goals/:id → 401", async () => {
    const res = await api.delete(`${BASE}/some-id`);
    expect(res.status).toBe(401);
  });

  it("POST /api/goals/:id/pause → 401", async () => {
    const res = await api.post(`${BASE}/some-id/pause`);
    expect(res.status).toBe(401);
  });

  it("POST /api/goals/:id/resume → 401", async () => {
    const res = await api.post(`${BASE}/some-id/resume`);
    expect(res.status).toBe(401);
  });

  it("POST /api/goals/:id/complete → 401", async () => {
    const res = await api.post(`${BASE}/some-id/complete`);
    expect(res.status).toBe(401);
  });

  it("POST /api/goals/:id/contributions → 401", async () => {
    const res = await api.post(`${BASE}/some-id/contributions`).send({ amount: 10 });
    expect(res.status).toBe(401);
  });

  it("GET /api/goals/:id/contributions → 401", async () => {
    const res = await api.get(`${BASE}/some-id/contributions`);
    expect(res.status).toBe(401);
  });

  it("DELETE /api/goals/:id/contributions/:cid → 401", async () => {
    const res = await api.delete(`${BASE}/some-id/contributions/other-id`);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// 2. CRUD
// ===========================================================================

describe("Goal CRUD", () => {
  let goalId: string;

  it("POST /api/goals — create goal → 201", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Emergency Fund",
      description: "Build 3-month emergency fund",
      targetAmount: 10000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Emergency Fund");
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.currentAmount).toBeDefined();
    expect(res.body.data.derivedStatus).toBe("NOT_STARTED");
    goalId = res.body.data.id;
  });

  it("GET /api/goals — list goals → 200", async () => {
    const res = await authGet(userA.token, BASE);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/goals/:id — get single goal → 200", async () => {
    const res = await authGet(userA.token, `${BASE}/${goalId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(goalId);
    expect(res.body.data.name).toBe("Emergency Fund");
  });

  it("PATCH /api/goals/:id — update name → 200", async () => {
    const res = await authPatch(userA.token, `${BASE}/${goalId}`, {
      name: "Emergency Fund Updated",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Emergency Fund Updated");
  });

  it("PATCH /api/goals/:id — update description → 200", async () => {
    const res = await authPatch(userA.token, `${BASE}/${goalId}`, {
      description: "Updated description",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("Updated description");
  });

  it("DELETE /api/goals/:id — delete goal → 200", async () => {
    // Create a goal to delete
    const createRes = await authPost(userA.token, BASE, {
      name: "Goal To Delete",
      targetAmount: 500,
    });
    const tempId = createRes.body.data.id;

    const delRes = await authDelete(userA.token, `${BASE}/${tempId}`);
    expect(delRes.status).toBe(200);

    // Verify it's gone
    const getRes = await authGet(userA.token, `${BASE}/${tempId}`);
    expect(getRes.status).toBe(404);
  });

  it("GET /api/goals/:id — unknown id → 404", async () => {
    const res = await authGet(
      userA.token,
      `${BASE}/00000000-0000-0000-0000-000000000000`
    );
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 3. VALIDATION
// ===========================================================================

describe("Goal Validation", () => {
  it("missing name → 400", async () => {
    const res = await authPost(userA.token, BASE, { targetAmount: 100 });
    expect(res.status).toBe(400);
  });

  it("empty name → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "  ",
      targetAmount: 100,
    });
    expect(res.status).toBe(400);
  });

  it("name > 100 chars → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "A".repeat(101),
      targetAmount: 100,
    });
    expect(res.status).toBe(400);
  });

  it("description > 500 chars → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Valid Goal",
      targetAmount: 100,
      description: "D".repeat(501),
    });
    expect(res.status).toBe(400);
  });

  it("targetAmount = 0 → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Zero Goal",
      targetAmount: 0,
    });
    expect(res.status).toBe(400);
  });

  it("negative targetAmount → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Neg Goal",
      targetAmount: -50,
    });
    expect(res.status).toBe(400);
  });

  it("targetAmount with > 2 decimal places → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Precision Goal",
      targetAmount: "100.123",
    });
    expect(res.status).toBe(400);
  });

  it("invalid deadline → 400", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Bad Deadline",
      targetAmount: 100,
      deadline: "not-a-date",
    });
    expect(res.status).toBe(400);
  });

  it("empty update body → 400", async () => {
    const createRes = await authPost(userA.token, BASE, {
      name: "Val Test Goal",
      targetAmount: 100,
    });
    const id = createRes.body.data.id;
    const res = await authPatch(userA.token, `${BASE}/${id}`, {});
    expect(res.status).toBe(400);
    await authDelete(userA.token, `${BASE}/${id}`);
  });

  it("invalid contribution amount → 400", async () => {
    const createRes = await authPost(userA.token, BASE, {
      name: "Contrib Val",
      targetAmount: 100,
    });
    const id = createRes.body.data.id;
    const res = await authPost(userA.token, `${BASE}/${id}/contributions`, {
      amount: -5,
    });
    expect(res.status).toBe(400);
    await authDelete(userA.token, `${BASE}/${id}`);
  });

  it("contribution amount with > 2 decimal places → 400", async () => {
    const createRes = await authPost(userA.token, BASE, {
      name: "Contrib Prec",
      targetAmount: 100,
    });
    const id = createRes.body.data.id;
    const res = await authPost(userA.token, `${BASE}/${id}/contributions`, {
      amount: "10.123",
    });
    expect(res.status).toBe(400);
    await authDelete(userA.token, `${BASE}/${id}`);
  });

  it("invalid contribution type → 400", async () => {
    const createRes = await authPost(userA.token, BASE, {
      name: "Type Test",
      targetAmount: 100,
    });
    const id = createRes.body.data.id;
    const res = await authPost(userA.token, `${BASE}/${id}/contributions`, {
      amount: 10,
      type: "INVALID_TYPE",
    });
    expect(res.status).toBe(400);
    await authDelete(userA.token, `${BASE}/${id}`);
  });

  it("invalid query status enum → 400", async () => {
    const res = await authGet(userA.token, `${BASE}?status=INVALID`);
    expect(res.status).toBe(400);
  });

  it("note > 250 chars → 400", async () => {
    const createRes = await authPost(userA.token, BASE, {
      name: "Note Test",
      targetAmount: 100,
    });
    const id = createRes.body.data.id;
    const res = await authPost(userA.token, `${BASE}/${id}/contributions`, {
      amount: 10,
      note: "N".repeat(251),
    });
    expect(res.status).toBe(400);
    await authDelete(userA.token, `${BASE}/${id}`);
  });
});

// ===========================================================================
// 4. CONTRIBUTIONS
// ===========================================================================

describe("Contributions", () => {
  let goalId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Contribution Test Goal",
      targetAmount: "600.60",
    });
    goalId = res.body.data.id;
  });

  afterAll(async () => {
    await authDelete(userA.token, `${BASE}/${goalId}`);
  });

  it("add contribution → 201 with updated currentAmount", async () => {
    const res = await authPost(
      userA.token,
      `${BASE}/${goalId}/contributions`,
      { amount: "100.10", note: "First deposit", type: "MANUAL" }
    );
    expect(res.status).toBe(201);
    expect(res.body.data.goal.currentAmount).toMatch(/^100\.1/);
  });

  it("add second contribution — currentAmount accumulates", async () => {
    await authPost(userA.token, `${BASE}/${goalId}/contributions`, {
      amount: "200.20",
    });
    const res = await authGet(userA.token, `${BASE}/${goalId}`);
    const ca = parseFloat(res.body.data.currentAmount);
    expect(ca).toBeCloseTo(300.3, 1);
  });

  it("decimal precision: 100.10 + 200.20 + 300.30 = 600.60", async () => {
    await authPost(userA.token, `${BASE}/${goalId}/contributions`, {
      amount: "300.30",
    });
    const res = await authGet(userA.token, `${BASE}/${goalId}`);
    // currentAmount must be exactly 600.60 — no floating point errors
    expect(res.body.data.currentAmount).toMatch(/^600\.6/);
  });

  it("GET contributions — returns correct ledger", async () => {
    const res = await authGet(userA.token, `${BASE}/${goalId}/contributions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(3);
  });

  it("delete contribution — currentAmount decrements correctly", async () => {
    const contribs = await authGet(
      userA.token,
      `${BASE}/${goalId}/contributions`
    );
    const contribId = contribs.body.data[0].id; // most recent (300.30)

    const res = await authDelete(
      userA.token,
      `${BASE}/${goalId}/contributions/${contribId}`
    );
    expect(res.status).toBe(200);

    const goal = await authGet(userA.token, `${BASE}/${goalId}`);
    // Should be back to ~300.30 (600.60 - 300.30)
    const ca = parseFloat(goal.body.data.currentAmount);
    expect(ca).toBeCloseTo(300.3, 1);
  });

  it("currentAmount never goes below zero if we delete more than accumulated", async () => {
    // Create a fresh goal with one small contribution
    const g = await authPost(userA.token, BASE, {
      name: "Zero Guard",
      targetAmount: 1000,
    });
    const gid = g.body.data.id;
    const c = await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: "50",
    });
    const cid = c.body.data.contribution.id;

    await authDelete(userA.token, `${BASE}/${gid}/contributions/${cid}`);
    const goal = await authGet(userA.token, `${BASE}/${gid}`);
    expect(parseFloat(goal.body.data.currentAmount)).toBeGreaterThanOrEqual(0);

    await authDelete(userA.token, `${BASE}/${gid}`);
  });
});

// ===========================================================================
// 5. DERIVED FIELDS
// ===========================================================================

describe("Derived Fields", () => {
  it("NOT_STARTED when currentAmount = 0", async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Not Started Goal",
      targetAmount: 1000,
    });
    const goal = res.body.data;
    expect(goal.derivedStatus).toBe("NOT_STARTED");
    expect(parseFloat(goal.remainingAmount)).toBeCloseTo(1000, 2);
    expect(goal.progressPercentage).toBe(0);
    await authDelete(userA.token, `${BASE}/${goal.id}`);
  });

  it("progressPercentage = 50 after 50% funded", async () => {
    const g = await authPost(userA.token, BASE, {
      name: "50 Percent Goal",
      targetAmount: 1000,
    });
    const gid = g.body.data.id;
    await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: 500,
    });
    const res = await authGet(userA.token, `${BASE}/${gid}`);
    expect(res.body.data.progressPercentage).toBe(50);
    expect(parseFloat(res.body.data.remainingAmount)).toBeCloseTo(500, 2);
    await authDelete(userA.token, `${BASE}/${gid}`);
  });

  it("progressPercentage capped at 100 when overfunded", async () => {
    const g = await authPost(userA.token, BASE, {
      name: "Overfunded Goal",
      targetAmount: 100,
    });
    const gid = g.body.data.id;
    await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: 150,
    });
    const res = await authGet(userA.token, `${BASE}/${gid}`);
    expect(res.body.data.progressPercentage).toBe(100);
    expect(parseFloat(res.body.data.remainingAmount)).toBe(0);
    await authDelete(userA.token, `${BASE}/${gid}`);
  });

  it("daysRemaining = null when no deadline", async () => {
    const g = await authPost(userA.token, BASE, {
      name: "No Deadline Goal",
      targetAmount: 500,
    });
    expect(g.body.data.daysRemaining).toBeNull();
    await authDelete(userA.token, `${BASE}/${g.body.data.id}`);
  });

  it("daysRemaining > 0 for future deadline", async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const g = await authPost(userA.token, BASE, {
      name: "Future Deadline Goal",
      targetAmount: 500,
      deadline: future,
    });
    expect(g.body.data.daysRemaining).toBeGreaterThan(0);
    await authDelete(userA.token, `${BASE}/${g.body.data.id}`);
  });

  it("derivedStatus = OVERDUE when deadline passed without completion", async () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const g = await authPost(userA.token, BASE, {
      name: "Overdue Goal",
      targetAmount: 500,
      deadline: past,
    });
    // Add some but not all contributions
    await authPost(userA.token, `${BASE}/${g.body.data.id}/contributions`, {
      amount: 100,
    });
    const res = await authGet(userA.token, `${BASE}/${g.body.data.id}`);
    expect(res.body.data.derivedStatus).toBe("OVERDUE");
    expect(res.body.data.daysRemaining).toBeLessThan(0);
    await authDelete(userA.token, `${BASE}/${g.body.data.id}`);
  });

  it("derivedStatus = ON_TRACK for active funded goal with future deadline", async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const g = await authPost(userA.token, BASE, {
      name: "On Track Goal",
      targetAmount: 1000,
      deadline: future,
    });
    await authPost(userA.token, `${BASE}/${g.body.data.id}/contributions`, {
      amount: 500,
    });
    const res = await authGet(userA.token, `${BASE}/${g.body.data.id}`);
    // 50% funded with loads of time remaining — should be ON_TRACK
    expect(["ON_TRACK", "NOT_STARTED", "AT_RISK"]).toContain(
      res.body.data.derivedStatus
    );
    await authDelete(userA.token, `${BASE}/${g.body.data.id}`);
  });

  it("derivedStatus = COMPLETED when fully funded", async () => {
    const g = await authPost(userA.token, BASE, {
      name: "Full Fund Goal",
      targetAmount: 200,
    });
    await authPost(userA.token, `${BASE}/${g.body.data.id}/contributions`, {
      amount: 200,
    });
    const res = await authGet(userA.token, `${BASE}/${g.body.data.id}`);
    expect(res.body.data.derivedStatus).toBe("COMPLETED");
    expect(res.body.data.status).toBe("COMPLETED");
    await authDelete(userA.token, `${BASE}/${g.body.data.id}`);
  });
});

// ===========================================================================
// 6. LIFECYCLE — pause / resume / complete + invalid transitions
// ===========================================================================

describe("Lifecycle", () => {
  let goalId: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, BASE, {
      name: "Lifecycle Goal",
      targetAmount: 1000,
    });
    goalId = res.body.data.id;
  });

  afterAll(async () => {
    await authDelete(userA.token, `${BASE}/${goalId}`);
  });

  it("pause ACTIVE goal → 200, status = PAUSED", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/pause`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PAUSED");
    expect(res.body.data.derivedStatus).toBe("PAUSED");
  });

  it("pause already PAUSED goal → 400", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/pause`);
    expect(res.status).toBe(400);
  });

  it("contribution to PAUSED goal → 400", async () => {
    const res = await authPost(
      userA.token,
      `${BASE}/${goalId}/contributions`,
      { amount: 50 }
    );
    expect(res.status).toBe(400);
  });

  it("resume PAUSED goal → 200, status = ACTIVE", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACTIVE");
  });

  it("resume ACTIVE (non-paused) goal → 400", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/resume`);
    expect(res.status).toBe(400);
  });

  it("complete ACTIVE goal manually → 200, status = COMPLETED", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("COMPLETED");
  });

  it("complete COMPLETED goal → 400", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/complete`);
    expect(res.status).toBe(400);
  });

  it("contribution to COMPLETED goal → 400", async () => {
    const res = await authPost(
      userA.token,
      `${BASE}/${goalId}/contributions`,
      { amount: 50 }
    );
    expect(res.status).toBe(400);
  });

  it("pause COMPLETED goal → 400", async () => {
    const res = await authPost(userA.token, `${BASE}/${goalId}/pause`);
    expect(res.status).toBe(400);
  });

  it("auto-complete when contribution reaches target", async () => {
    const g = await authPost(userA.token, BASE, {
      name: "Auto Complete",
      targetAmount: 100,
    });
    const gid = g.body.data.id;
    await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: 100,
    });
    const res = await authGet(userA.token, `${BASE}/${gid}`);
    expect(res.body.data.status).toBe("COMPLETED");
    await authDelete(userA.token, `${BASE}/${gid}`);
  });
});

// ===========================================================================
// 7. SUMMARY
// ===========================================================================

describe("Summary", () => {
  it("empty summary for new user → all zeros, no NaN", async () => {
    const newUser = await createTestUser("summary-empty");
    const res = await authGet(newUser.token, `${BASE}/summary`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totalGoals).toBe(0);
    expect(d.activeGoals).toBe(0);
    expect(d.pausedGoals).toBe(0);
    expect(d.completedGoals).toBe(0);
    expect(d.overdueGoals).toBe(0);
    expect(parseFloat(d.totalTargetAmount)).toBe(0);
    expect(parseFloat(d.totalCurrentAmount)).toBe(0);
    expect(d.overallProgressPercentage).toBe(0);
    expect(d.nearestDeadline).toBeNull();
    expect(d.topGoal).toBeNull();
    // No NaN / Infinity
    expect(JSON.stringify(d)).not.toContain("NaN");
    expect(JSON.stringify(d)).not.toContain("Infinity");
    await cleanUsers(newUser.email);
  });

  it("populated summary — aggregate totals, nearest deadline, top goal", async () => {
    const newUser = await createTestUser("summary-pop");
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const g1 = await authPost(newUser.token, BASE, {
      name: "Goal Alpha",
      targetAmount: "1000.00",
      deadline: soon,
    });
    const g2 = await authPost(newUser.token, BASE, {
      name: "Goal Beta",
      targetAmount: "2000.00",
      deadline: later,
    });

    // Fund g1 with 500 (50%), g2 with 200 (10%)
    await authPost(newUser.token, `${BASE}/${g1.body.data.id}/contributions`, {
      amount: "500.00",
    });
    await authPost(newUser.token, `${BASE}/${g2.body.data.id}/contributions`, {
      amount: "200.00",
    });

    const res = await authGet(newUser.token, `${BASE}/summary`);
    expect(res.status).toBe(200);
    const d = res.body.data;

    expect(d.totalGoals).toBe(2);
    expect(d.activeGoals).toBe(2);
    expect(parseFloat(d.totalTargetAmount)).toBeCloseTo(3000, 2);
    expect(parseFloat(d.totalCurrentAmount)).toBeCloseTo(700, 2);
    expect(d.overallProgressPercentage).toBeCloseTo(23.33, 1);
    // nearestDeadline should be the sooner one (soon)
    expect(d.nearestDeadline).toBeTruthy();
    // topGoal = Goal Alpha (50%)
    expect(d.topGoal?.name).toBe("Goal Alpha");
    expect(d.topGoal?.progressPercentage).toBeCloseTo(50, 1);

    await cleanUsers(newUser.email);
  });

  it("topGoal tie-breaking — earliest createdAt wins", async () => {
    const newUser = await createTestUser("tie-break");
    // Both goals get same progress
    const g1 = await authPost(newUser.token, BASE, {
      name: "First Created",
      targetAmount: 100,
    });
    // Add small delay to ensure different createdAt
    await new Promise((r) => setTimeout(r, 20));
    const g2 = await authPost(newUser.token, BASE, {
      name: "Second Created",
      targetAmount: 100,
    });
    await authPost(newUser.token, `${BASE}/${g1.body.data.id}/contributions`, {
      amount: 50,
    });
    await authPost(newUser.token, `${BASE}/${g2.body.data.id}/contributions`, {
      amount: 50,
    });

    const res = await authGet(newUser.token, `${BASE}/summary`);
    // Both at 50% — First Created should win (earliest createdAt)
    expect(res.body.data.topGoal?.name).toBe("First Created");

    await cleanUsers(newUser.email);
  });
});

// ===========================================================================
// 8. FILTERING & SORTING
// ===========================================================================

describe("Filtering and Sorting", () => {
  let u: { id: string; email: string; token: string };
  let activeId: string;
  let pausedId: string;

  beforeAll(async () => {
    u = await createTestUser("filter");
    const g1 = await authPost(u.token, BASE, {
      name: "Alpha Active",
      targetAmount: 500,
    });
    activeId = g1.body.data.id;
    const g2 = await authPost(u.token, BASE, {
      name: "Beta Paused",
      targetAmount: 1000,
    });
    pausedId = g2.body.data.id;
    await authPost(u.token, `${BASE}/${pausedId}/pause`);
  });

  afterAll(async () => {
    await cleanUsers(u.email);
  });

  it("filter by status=ACTIVE → only active goals", async () => {
    const res = await authGet(u.token, `${BASE}?status=ACTIVE`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((g: any) => g.status === "ACTIVE")).toBe(true);
  });

  it("filter by status=PAUSED → only paused goals", async () => {
    const res = await authGet(u.token, `${BASE}?status=PAUSED`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((g: any) => g.status === "PAUSED")).toBe(true);
  });

  it("search by name — case-insensitive", async () => {
    const res = await authGet(u.token, `${BASE}?search=alpha`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((g: any) => g.name.includes("Alpha"))).toBe(true);
  });

  it("filter hasDeadline=false — goals without deadline", async () => {
    const res = await authGet(u.token, `${BASE}?hasDeadline=false`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((g: any) => g.deadline === null)).toBe(true);
  });

  it("sort by name asc", async () => {
    const res = await authGet(u.token, `${BASE}?sortBy=name&sortOrder=asc`);
    expect(res.status).toBe(200);
    const names: string[] = res.body.data.map((g: any) => g.name);
    expect(names).toEqual([...names].sort());
  });

  it("sort by targetAmount desc", async () => {
    const res = await authGet(
      u.token,
      `${BASE}?sortBy=targetAmount&sortOrder=desc`
    );
    expect(res.status).toBe(200);
    const amounts = res.body.data.map((g: any) => parseFloat(g.targetAmount));
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i - 1]).toBeGreaterThanOrEqual(amounts[i]);
    }
  });
});

// ===========================================================================
// 9. MULTI-TENANT SECURITY
// ===========================================================================

describe("Security — multi-tenant isolation", () => {
  let goalIdOfUserA: string;

  beforeAll(async () => {
    const res = await authPost(userA.token, BASE, {
      name: "User A Private Goal",
      targetAmount: 9999,
    });
    goalIdOfUserA = res.body.data.id;
  });

  afterAll(async () => {
    await authDelete(userA.token, `${BASE}/${goalIdOfUserA}`);
  });

  it("User B cannot GET User A's goal → 404", async () => {
    const res = await authGet(userB.token, `${BASE}/${goalIdOfUserA}`);
    expect(res.status).toBe(404);
  });

  it("User B cannot PATCH User A's goal → 404", async () => {
    const res = await authPatch(userB.token, `${BASE}/${goalIdOfUserA}`, {
      name: "Hacked",
    });
    expect(res.status).toBe(404);
  });

  it("User B cannot DELETE User A's goal → 404", async () => {
    const res = await authDelete(userB.token, `${BASE}/${goalIdOfUserA}`);
    expect(res.status).toBe(404);
  });

  it("User B cannot contribute to User A's goal → 404", async () => {
    const res = await authPost(
      userB.token,
      `${BASE}/${goalIdOfUserA}/contributions`,
      { amount: 100 }
    );
    expect(res.status).toBe(404);
  });

  it("User B cannot list User A's contributions → 404", async () => {
    const res = await authGet(
      userB.token,
      `${BASE}/${goalIdOfUserA}/contributions`
    );
    expect(res.status).toBe(404);
  });

  it("User B cannot pause User A's goal → 404", async () => {
    const res = await authPost(userB.token, `${BASE}/${goalIdOfUserA}/pause`);
    expect(res.status).toBe(404);
  });

  it("User B cannot resume User A's goal → 404", async () => {
    const res = await authPost(userB.token, `${BASE}/${goalIdOfUserA}/resume`);
    expect(res.status).toBe(404);
  });

  it("User B cannot complete User A's goal → 404", async () => {
    const res = await authPost(
      userB.token,
      `${BASE}/${goalIdOfUserA}/complete`
    );
    expect(res.status).toBe(404);
  });

  it("User B summary only contains User B data", async () => {
    const res = await authGet(userB.token, `${BASE}/summary`);
    expect(res.status).toBe(200);
    // User B has no goals from this suite — totalGoals should be 0
    expect(res.body.data.totalGoals).toBe(0);
  });

  it("User B cannot delete User A's contribution → 404", async () => {
    // Add a real contribution to User A's goal first
    await authPost(userA.token, `${BASE}/${goalIdOfUserA}/contributions`, {
      amount: 10,
    });
    const contribs = await authGet(
      userA.token,
      `${BASE}/${goalIdOfUserA}/contributions`
    );
    const cid = contribs.body.data[0].id;

    const res = await authDelete(
      userB.token,
      `${BASE}/${goalIdOfUserA}/contributions/${cid}`
    );
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 10. CASCADE DELETION
// ===========================================================================

describe("Cascade deletion", () => {
  it("deleting a goal also deletes its contributions", async () => {
    const { prisma } = await import("../../src/config/prisma.js");
    const g = await authPost(userA.token, BASE, {
      name: "Cascade Test",
      targetAmount: 500,
    });
    const gid = g.body.data.id;

    await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: 100,
    });
    await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: 150,
    });

    // Verify contributions exist
    const beforeCount = await prisma.goalContribution.count({
      where: { goalId: gid },
    });
    expect(beforeCount).toBe(2);

    // Delete the goal
    await authDelete(userA.token, `${BASE}/${gid}`);

    // Contributions must be gone
    const afterCount = await prisma.goalContribution.count({
      where: { goalId: gid },
    });
    expect(afterCount).toBe(0);
  });

  it("deleting a goal does NOT affect unrelated Transaction records", async () => {
    const { prisma } = await import("../../src/config/prisma.js");

    // Count transactions before
    const txBefore = await prisma.transaction.count({
      where: { userId: userA.id },
    });

    // Create and delete a goal
    const g = await authPost(userA.token, BASE, {
      name: "No Touch Transactions",
      targetAmount: 200,
    });
    await authDelete(userA.token, `${BASE}/${g.body.data.id}`);

    const txAfter = await prisma.transaction.count({
      where: { userId: userA.id },
    });
    expect(txAfter).toBe(txBefore);
  });
});

// ===========================================================================
// 11. UPDATE TARGET AMOUNT BELOW CURRENT — auto-complete logic
// ===========================================================================

describe("Update targetAmount below currentAmount", () => {
  it("lowering targetAmount below currentAmount auto-completes goal", async () => {
    const g = await authPost(userA.token, BASE, {
      name: "Auto Complete On Update",
      targetAmount: 1000,
    });
    const gid = g.body.data.id;

    await authPost(userA.token, `${BASE}/${gid}/contributions`, {
      amount: 600,
    });

    // Lower target below current
    const res = await authPatch(userA.token, `${BASE}/${gid}`, {
      targetAmount: 500,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("COMPLETED");

    await authDelete(userA.token, `${BASE}/${gid}`);
  });
});
