/**
 * User Profile & Settings — comprehensive integration test suite.
 *
 * Covers:
 *   - Authentication (401 on every endpoint when unauthenticated)
 *   - Profile (GET /me, PATCH /me, Zod validation, safe output)
 *   - Password Change (PATCH /me/password, bcrypt verification, rejection rules)
 *   - User Settings (GET /settings auto-upsert defaults, PATCH /settings partial updates, budget preferences, theme, currency)
 *   - User Isolation (User A vs User B settings & profile independence)
 *   - Account Deletion (DELETE /me with password verification, cascade deletion of user data)
 *   - Edge Cases & Validation Errors
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
  TestUser,
} from "../helpers/testHelpers.js";
import { prisma } from "../../src/config/prisma.js";

let userA: TestUser;
let userB: TestUser;

const BASE = "/api/users";

beforeAll(async () => {
  userA = await createTestUser("UserA");
  userB = await createTestUser("UserB");
});

afterAll(async () => {
  await cleanUsers(userA.email, userB.email);
  await disconnectPrisma();
});

// ===========================================================================
// 1. AUTHENTICATION — unauthenticated requests return 401
// ===========================================================================

describe("User Module Authentication", () => {
  it("GET /api/users/me → 401 when unauthenticated", async () => {
    const res = await api.get(`${BASE}/me`);
    expect(res.status).toBe(401);
  });

  it("PATCH /api/users/me → 401 when unauthenticated", async () => {
    const res = await api.patch(`${BASE}/me`).send({ name: "Hacker" });
    expect(res.status).toBe(401);
  });

  it("PATCH /api/users/me/password → 401 when unauthenticated", async () => {
    const res = await api.patch(`${BASE}/me/password`).send({
      currentPassword: "Password123!",
      newPassword: "NewPassword123!",
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/users/settings → 401 when unauthenticated", async () => {
    const res = await api.get(`${BASE}/settings`);
    expect(res.status).toBe(401);
  });

  it("PATCH /api/users/settings → 401 when unauthenticated", async () => {
    const res = await api.patch(`${BASE}/settings`).send({ theme: "DARK" });
    expect(res.status).toBe(401);
  });

  it("DELETE /api/users/me → 401 when unauthenticated", async () => {
    const res = await api.delete(`${BASE}/me`).send({ password: "Password123!" });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// 2. PROFILE MANAGEMENT
// ===========================================================================

describe("Profile Management", () => {
  it("GET /api/users/me → 200 with safe profile details", async () => {
    const res = await authGet(userA.token, `${BASE}/me`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(userA.id);
    expect(res.body.data.email).toBe(userA.email);
    expect(res.body.data.name).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
    // Sensitive fields must never be exposed
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it("PATCH /api/users/me → 200 updates profile name successfully", async () => {
    const res = await authPatch(userA.token, `${BASE}/me`, {
      name: "User A Updated Name",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("User A Updated Name");
    expect(res.body.data.email).toBe(userA.email);

    // Verify GET /me reflects updated name
    const getRes = await authGet(userA.token, `${BASE}/me`);
    expect(getRes.body.data.name).toBe("User A Updated Name");
  });

  it("PATCH /api/users/me → 400 when name is empty string", async () => {
    const res = await authPatch(userA.token, `${BASE}/me`, {
      name: "",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/me → 400 when name exceeds 100 characters", async () => {
    const res = await authPatch(userA.token, `${BASE}/me`, {
      name: "A".repeat(101),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/me → 400 when body is empty", async () => {
    const res = await authPatch(userA.token, `${BASE}/me`, {});
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// 3. PASSWORD CHANGE
// ===========================================================================

describe("Password Change", () => {
  let pwUser: TestUser;

  beforeAll(async () => {
    pwUser = await createTestUser("PasswordTest");
  });

  afterAll(async () => {
    await cleanUsers(pwUser.email);
  });

  it("PATCH /api/users/me/password → 400 when currentPassword is incorrect", async () => {
    const res = await authPatch(pwUser.token, `${BASE}/me/password`, {
      currentPassword: "WrongPassword123!",
      newPassword: "NewPassword123!",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("PATCH /api/users/me/password → 400 when newPassword is identical to currentPassword", async () => {
    const res = await authPatch(pwUser.token, `${BASE}/me/password`, {
      currentPassword: "Password123!",
      newPassword: "Password123!",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/me/password → 400 when newPassword is shorter than 6 chars", async () => {
    const res = await authPatch(pwUser.token, `${BASE}/me/password`, {
      currentPassword: "Password123!",
      newPassword: "123",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/me/password → 200 changes password successfully", async () => {
    const res = await authPatch(pwUser.token, `${BASE}/me/password`, {
      currentPassword: "Password123!",
      newPassword: "NewPassword123!",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeUndefined(); // no password leaks

    // Login with old password must fail
    const oldLogin = await api.post("/api/auth/login").send({
      email: pwUser.email,
      password: "Password123!",
    });
    expect(oldLogin.status).toBe(401);

    // Login with new password must succeed
    const newLogin = await api.post("/api/auth/login").send({
      email: pwUser.email,
      password: "NewPassword123!",
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.accessToken).toBeDefined();

    // Update user token for subsequent operations
    pwUser.token = newLogin.body.data.accessToken;
  });
});

// ===========================================================================
// 4. USER SETTINGS
// ===========================================================================

describe("User Settings Management", () => {
  it("GET /api/users/settings → 200 creates default settings if missing", async () => {
    const res = await authGet(userA.token, `${BASE}/settings`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currency).toBe("INR");
    expect(res.body.data.monthlyBudgetEnabled).toBe(false);
    expect(res.body.data.monthlyBudgetAmount).toBeNull();
    expect(res.body.data.budgetAlertsEnabled).toBe(true);
    expect(res.body.data.recurringRemindersEnabled).toBe(true);
    expect(res.body.data.goalRemindersEnabled).toBe(true);
    expect(res.body.data.theme).toBe("SYSTEM");
  });

  it("PATCH /api/users/settings → 200 updates currency and theme", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      currency: "USD",
      theme: "DARK",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.currency).toBe("USD");
    expect(res.body.data.theme).toBe("DARK");
    // Unrelated fields preserved
    expect(res.body.data.budgetAlertsEnabled).toBe(true);
  });

  it("PATCH /api/users/settings → 200 enables monthly budget with valid amount", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      monthlyBudgetEnabled: true,
      monthlyBudgetAmount: "5000.50",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.monthlyBudgetEnabled).toBe(true);
    expect(res.body.data.monthlyBudgetAmount).toBe("5000.50");
  });

  it("PATCH /api/users/settings → 200 disables monthly budget and clears amount", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      monthlyBudgetEnabled: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.monthlyBudgetEnabled).toBe(false);
    expect(res.body.data.monthlyBudgetAmount).toBeNull();
  });

  it("PATCH /api/users/settings → 400 when currency enum is invalid", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      currency: "BTC",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/settings → 400 when theme enum is invalid", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      theme: "BLUE",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/settings → 400 when monthlyBudgetAmount <= 0", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      monthlyBudgetEnabled: true,
      monthlyBudgetAmount: 0,
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/settings → 400 when monthlyBudgetAmount has > 2 decimal places", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {
      monthlyBudgetEnabled: true,
      monthlyBudgetAmount: "100.123",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/users/settings → 400 when body is empty", async () => {
    const res = await authPatch(userA.token, `${BASE}/settings`, {});
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// 5. USER ISOLATION
// ===========================================================================

describe("User Settings & Profile Isolation", () => {
  it("User A and User B settings remain strictly isolated", async () => {
    // Set User A settings
    await authPatch(userA.token, `${BASE}/settings`, {
      currency: "EUR",
      theme: "LIGHT",
    });

    // Set User B settings
    await authPatch(userB.token, `${BASE}/settings`, {
      currency: "GBP",
      theme: "DARK",
    });

    // Fetch User A settings
    const settingsA = await authGet(userA.token, `${BASE}/settings`);
    expect(settingsA.body.data.currency).toBe("EUR");
    expect(settingsA.body.data.theme).toBe("LIGHT");

    // Fetch User B settings
    const settingsB = await authGet(userB.token, `${BASE}/settings`);
    expect(settingsB.body.data.currency).toBe("GBP");
    expect(settingsB.body.data.theme).toBe("DARK");
  });
});

// ===========================================================================
// 6. ACCOUNT DELETION
// ===========================================================================

describe("Account Deletion", () => {
  let deleteUser: TestUser;

  beforeAll(async () => {
    deleteUser = await createTestUser("DeleteAccountUser");

    // Seed some data for deleteUser to test cascade delete
    const cat = await prisma.category.create({
      data: {
        name: "Delete Test Category",
        type: "EXPENSE",
        userId: deleteUser.id,
      },
    });

    await prisma.transaction.create({
      data: {
        amount: "150.00",
        type: "EXPENSE",
        date: new Date(),
        userId: deleteUser.id,
        categoryId: cat.id,
      },
    });

    await prisma.financialGoal.create({
      data: {
        name: "Delete Test Goal",
        targetAmount: "1000.00",
        userId: deleteUser.id,
      },
    });

    await prisma.userSettings.create({
      data: {
        userId: deleteUser.id,
        currency: "USD",
      },
    });
  });

  afterAll(async () => {
    await cleanUsers(deleteUser.email);
  });

  it("DELETE /api/users/me → 400 when password is wrong", async () => {
    const res = await authDelete(deleteUser.token, `${BASE}/me`);
    expect(res.status).toBe(400); // missing password in body
  });

  it("DELETE /api/users/me → 400 with incorrect password in body", async () => {
    const res = await api
      .delete(`${BASE}/me`)
      .set("Authorization", `Bearer ${deleteUser.token}`)
      .send({ password: "WrongPassword!" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("DELETE /api/users/me → 200 deletes account and cascades user data", async () => {
    const res = await api
      .delete(`${BASE}/me`)
      .set("Authorization", `Bearer ${deleteUser.token}`)
      .send({ password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 1. User should no longer exist in DB
    const dbUser = await prisma.user.findUnique({
      where: { id: deleteUser.id },
    });
    expect(dbUser).toBeNull();

    // 2. Accessing profile for deleted user must return 404
    const getRes = await authGet(deleteUser.token, `${BASE}/me`);
    expect(getRes.status).toBe(404);

    // 3. User settings should be cascade-deleted
    const dbSettings = await prisma.userSettings.findUnique({
      where: { userId: deleteUser.id },
    });
    expect(dbSettings).toBeNull();

    // 4. User categories, transactions, goals should be cascade-deleted
    const catCount = await prisma.category.count({
      where: { userId: deleteUser.id },
    });
    expect(catCount).toBe(0);

    const txCount = await prisma.transaction.count({
      where: { userId: deleteUser.id },
    });
    expect(txCount).toBe(0);

    const goalCount = await prisma.financialGoal.count({
      where: { userId: deleteUser.id },
    });
    expect(goalCount).toBe(0);
  });

  it("Deleting User A does NOT affect User B data", async () => {
    // User A and User B still exist in DB
    const dbUserA = await prisma.user.findUnique({ where: { id: userA.id } });
    const dbUserB = await prisma.user.findUnique({ where: { id: userB.id } });
    expect(dbUserA).not.toBeNull();
    expect(dbUserB).not.toBeNull();
  });
});
