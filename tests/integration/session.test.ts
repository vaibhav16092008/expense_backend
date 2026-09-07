/**
 * Phase 3 — Authentication & Session Management Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { api, createTestUser, cleanUsers, authPost, authPatch, authDelete, type TestUser } from "../helpers/testHelpers.js";
import { prisma } from "../../src/config/prisma.js";
import { hashRefreshToken } from "../../src/utils/token.js";

// Helper to extract cookie from supertest response
function getRefreshCookie(res: { headers: Record<string, unknown> }): string | undefined {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie as string];
  const match = cookies.find((c) => c.startsWith("refreshToken="));
  if (!match) return undefined;
  return match.split(";")[0].split("=")[1];
}

describe("Phase 3 — Session Management & Refresh Token Lifecycle", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser("sess_a");
    userB = await createTestUser("sess_b");
  });

  afterAll(async () => {
    await cleanUsers(userA.email, userB.email);
  });

  // -------------------------------------------------------------------------
  // 1. Session Creation on Login
  // -------------------------------------------------------------------------
  describe("Login Session Creation", () => {
    it("200 — login creates UserSession in DB with SHA-256 token hash and sets HttpOnly cookie", async () => {
      const email = `session_login_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "Session User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.accessToken).toBeTypeOf("string");
      expect(loginRes.body.data.expiresIn).toBe(900);

      // Verify Set-Cookie header contains refreshToken
      const rawCookieToken = getRefreshCookie(loginRes);
      expect(rawCookieToken).toBeDefined();

      // Verify raw token is NOT stored in DB, but its SHA-256 hash IS stored
      const tokenHash = hashRefreshToken(rawCookieToken!);
      const dbSession = await prisma.userSession.findUnique({
        where: { currentTokenHash: tokenHash },
      });

      expect(dbSession).not.toBeNull();
      expect(dbSession?.userId).toBe(loginRes.body.data.user.id);
      expect(dbSession?.revokedAt).toBeNull();

      await cleanUsers(email);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Refresh Token Rotation
  // -------------------------------------------------------------------------
  describe("Refresh Token Rotation", () => {
    it("200 — valid refresh token cookie rotates token and returns new access token", async () => {
      const email = `session_ref_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "Ref User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const rt1 = getRefreshCookie(loginRes)!;

      // Call refresh endpoint with cookie + CSRF custom header
      const refRes = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt1}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(refRes.status).toBe(200);
      expect(refRes.body.data.accessToken).toBeTypeOf("string");
      expect(refRes.body.data.expiresIn).toBe(900);

      const rt2 = getRefreshCookie(refRes);
      expect(rt2).toBeDefined();
      expect(rt2).not.toBe(rt1);

      // Verify DB reflects rotation (rt1 is now previousTokenHash, rt2 is currentTokenHash)
      const h1 = hashRefreshToken(rt1);
      const h2 = hashRefreshToken(rt2!);

      const dbSession = await prisma.userSession.findUnique({
        where: { currentTokenHash: h2 },
      });

      expect(dbSession).not.toBeNull();
      expect(dbSession?.previousTokenHash).toBe(h1);
      expect(dbSession?.rotatedAt).not.toBeNull();

      await cleanUsers(email);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Concurrent Refresh Handling (10s Grace Period)
  // -------------------------------------------------------------------------
  describe("Concurrent Refresh Handling (10s Grace Period)", () => {
    it("200 — submitting previous token within 10s returns new access token without re-rotating or revoking", async () => {
      const email = `session_grace_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "Grace User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const rt1 = getRefreshCookie(loginRes)!;

      // First refresh: rotates rt1 -> rt2
      const ref1 = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt1}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(ref1.status).toBe(200);

      // Immediately submit rt1 again (concurrent request within 10s grace)
      const ref2 = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt1}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(ref2.status).toBe(200);
      expect(ref2.body.data.accessToken).toBeTypeOf("string");

      // Verify no new cookie was set on grace reflection
      const rtGrace = getRefreshCookie(ref2);
      expect(rtGrace).toBeUndefined();

      // Verify session in DB is still active and not revoked
      const h1 = hashRefreshToken(rt1);
      const dbSession = await prisma.userSession.findFirst({
        where: { previousTokenHash: h1 },
      });
      expect(dbSession?.revokedAt).toBeNull();

      await cleanUsers(email);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Reuse Detection (After 10s Grace Period)
  // -------------------------------------------------------------------------
  describe("Reuse Detection", () => {
    it("401 — submitting previous token after 10s triggers reuse detection and revokes ALL user sessions", async () => {
      const email = `session_reuse_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "Reuse User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const rt1 = getRefreshCookie(loginRes)!;

      // Rotate rt1 -> rt2
      const ref1 = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt1}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(ref1.status).toBe(200);

      // Manually backdate rotatedAt timestamp in DB to 15 seconds ago to simulate replay attack
      const h1 = hashRefreshToken(rt1);
      await prisma.userSession.update({
        where: { previousTokenHash: h1 },
        data: { rotatedAt: new Date(Date.now() - 15000) },
      });

      // Submit stale rt1 after 15 seconds -> REUSE DETECTED!
      const refStale = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt1}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(refStale.status).toBe(401);
      expect(refStale.body.message).toMatch(/reuse detected/i);

      // Verify all DB sessions for this user are now revoked
      const activeSessions = await prisma.userSession.findMany({
        where: { userId: loginRes.body.data.user.id, revokedAt: null },
      });
      expect(activeSessions).toHaveLength(0);

      await cleanUsers(email);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Logout & Logout All
  // -------------------------------------------------------------------------
  describe("Logout & Logout All", () => {
    it("200 — POST /api/auth/logout revokes current session and clears cookie", async () => {
      const email = `session_logout_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "Logout User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const rt = getRefreshCookie(loginRes)!;

      const logoutRes = await api
        .post("/api/auth/logout")
        .set("Cookie", `refreshToken=${rt}`)
        .set("X-Requested-With", "XMLHttpRequest");

      expect(logoutRes.status).toBe(200);

      // Confirm session is revoked in DB
      const h = hashRefreshToken(rt);
      const dbSession = await prisma.userSession.findFirst({
        where: { currentTokenHash: h },
      });
      expect(dbSession?.revokedAt).not.toBeNull();

      // Subsequent refresh attempt fails
      const refFail = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(refFail.status).toBe(401);

      await cleanUsers(email);
    });

    it("200 — POST /api/auth/logout-all revokes all sessions for authenticated user", async () => {
      const email = `session_logoutall_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "LogoutAll User", email, password });
      const login1 = await api.post("/api/auth/login").send({ email, password });
      const login2 = await api.post("/api/auth/login").send({ email, password });

      const rt1 = getRefreshCookie(login1)!;
      const rt2 = getRefreshCookie(login2)!;
      const token2 = login2.body.data.accessToken;

      // Logout all devices using login2 token
      const logoutAllRes = await authPost(token2, "/api/auth/logout-all");
      expect(logoutAllRes.status).toBe(200);

      // Both refresh tokens must now be rejected
      const ref1 = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt1}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(ref1.status).toBe(401);

      const ref2 = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt2}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(ref2.status).toBe(401);

      await cleanUsers(email);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Password Change & Account Deletion Revocation
  // -------------------------------------------------------------------------
  describe("Password Change Revocation", () => {
    it("200 — changing password revokes all active DB sessions for user", async () => {
      const email = `session_pwd_${Date.now()}@example.com`;
      const password = "Password123!";
      const newPassword = "NewPassword123!";

      await api.post("/api/auth/register").send({ name: "Pwd User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const rt = getRefreshCookie(loginRes)!;
      const token = loginRes.body.data.accessToken;

      // Change password
      const changeRes = await authPatch(token, "/api/users/me/password", {
        currentPassword: password,
        newPassword,
      });
      expect(changeRes.status).toBe(200);

      // Refresh using previous cookie must be rejected
      const refRes = await api
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${rt}`)
        .set("X-Requested-With", "XMLHttpRequest");
      expect(refRes.status).toBe(401);

      await cleanUsers(email);
    });

    it("200 — deleting account cascades and removes user_sessions from DB", async () => {
      const email = `session_del_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "Del User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const userId = loginRes.body.data.user.id;
      const token = loginRes.body.data.accessToken;

      const delRes = await api
        .delete("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ password });
      expect(delRes.status).toBe(200);

      // Check DB sessions for user are completely removed
      const dbSessions = await prisma.userSession.findMany({ where: { userId } });
      expect(dbSessions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 7. CSRF Protection
  // -------------------------------------------------------------------------
  describe("CSRF Protection", () => {
    it("403 — POST /api/auth/refresh fails without custom client header in production/non-test", async () => {
      // Temporarily test CSRF check helper
      const email = `session_csrf_${Date.now()}@example.com`;
      const password = "Password123!";

      await api.post("/api/auth/register").send({ name: "CSRF User", email, password });
      const loginRes = await api.post("/api/auth/login").send({ email, password });
      const rt = getRefreshCookie(loginRes)!;

      // Request without custom header (simulating standard browser form POST)
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const res = await api
          .post("/api/auth/refresh")
          .set("Cookie", `refreshToken=${rt}`);
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/CSRF protection/i);
      } finally {
        process.env.NODE_ENV = origEnv;
        await cleanUsers(email);
      }
    });
  });
});
