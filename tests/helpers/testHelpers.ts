/**
 * Shared test helpers for ExpenseIQ integration tests.
 * Uses the real database (same DATABASE_URL) with cleanup after each suite.
 */
import request from "supertest";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

// Re-export supertest agent bound to the app
export const api = request(app);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

let _userCounter = 0;

/**
 * Register a new unique test user and return their auth token + id.
 */
export async function createTestUser(suffix?: string): Promise<TestUser> {
  const tag = suffix ?? String(++_userCounter);
  const email = `test_goal_${tag}_${Date.now()}@example.com`;
  const password = "Password123!";

  const reg = await api.post("/api/auth/register").send({
    name: `Test User ${tag}`,
    email,
    password,
  });

  if (reg.status !== 201) {
    throw new Error(
      `createTestUser failed: ${reg.status} ${JSON.stringify(reg.body)}`
    );
  }

  const login = await api.post("/api/auth/login").send({ email, password });

  if (login.status !== 200) {
    throw new Error(
      `createTestUser login failed: ${login.status} ${JSON.stringify(login.body)}`
    );
  }

  return {
    id: login.body.data.user.id,
    email,
    token: login.body.data.accessToken,
  };
}

// ---------------------------------------------------------------------------
// Database cleanup helpers
// ---------------------------------------------------------------------------

/**
 * Delete all financial goals (and their cascaded contributions) for given user IDs.
 */
export async function cleanGoals(...userIds: string[]): Promise<void> {
  await prisma.financialGoal.deleteMany({
    where: { userId: { in: userIds } },
  });
}

/**
 * Delete test users by email pattern (cascade deletes all their data).
 */
export async function cleanUsers(...emails: string[]): Promise<void> {
  await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });
}

// ---------------------------------------------------------------------------
// Shorthand: authenticated request factories
// ---------------------------------------------------------------------------

export function authGet(token: string, url: string) {
  return api.get(url).set("Authorization", `Bearer ${token}`);
}

export function authPost(token: string, url: string, body?: object) {
  return api
    .post(url)
    .set("Authorization", `Bearer ${token}`)
    .send(body ?? {});
}

export function authPatch(token: string, url: string, body?: object) {
  return api
    .patch(url)
    .set("Authorization", `Bearer ${token}`)
    .send(body ?? {});
}

export function authDelete(token: string, url: string) {
  return api.delete(url).set("Authorization", `Bearer ${token}`);
}

// ---------------------------------------------------------------------------
// Prisma teardown
// ---------------------------------------------------------------------------

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
