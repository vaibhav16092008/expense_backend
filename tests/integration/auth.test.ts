/**
 * Auth Integration Tests
 * Tests: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 */
import { describe, it, expect, afterAll } from "vitest";
import { api, cleanUsers } from "../helpers/testHelpers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uniqueEmail = (tag: string) =>
  `auth_${tag}_${Date.now()}@example.com`;

const validUser = () => {
  const email = uniqueEmail("reg");
  return { name: "Auth User", email, password: "Password123!" };
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe("Auth — Registration POST /api/auth/register", () => {
  const createdEmails: string[] = [];

  afterAll(async () => {
    await cleanUsers(...createdEmails);
  });

  it("201 — registers a new user and returns safe user data", async () => {
    const user = validUser();
    createdEmails.push(user.email);

    const res = await api.post("/api/auth/register").send(user);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      name: user.name,
      email: user.email.toLowerCase(),
    });
  });

  it("201 — password hash is never returned in response", async () => {
    const user = validUser();
    createdEmails.push(user.email);

    const res = await api.post("/api/auth/register").send(user);
    expect(res.status).toBe(201);
    expect(res.body.data.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("201 — email is lowercased on storage", async () => {
    const user = { name: "Case User", email: uniqueEmail("CASE").toUpperCase(), password: "Password123!" };
    createdEmails.push(user.email.toLowerCase());

    const res = await api.post("/api/auth/register").send(user);
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(user.email.toLowerCase());
  });

  it("409 — duplicate email is rejected", async () => {
    const user = validUser();
    createdEmails.push(user.email);

    await api.post("/api/auth/register").send(user);
    const res = await api.post("/api/auth/register").send(user);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("400 — invalid email format is rejected", async () => {
    const res = await api.post("/api/auth/register").send({
      name: "Bad Email",
      email: "not-an-email",
      password: "Password123!",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — missing email is rejected", async () => {
    const res = await api.post("/api/auth/register").send({
      name: "No Email",
      password: "Password123!",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — missing name is rejected", async () => {
    const res = await api.post("/api/auth/register").send({
      email: uniqueEmail("noname"),
      password: "Password123!",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — missing password is rejected", async () => {
    const res = await api.post("/api/auth/register").send({
      name: "No Password",
      email: uniqueEmail("nopwd"),
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — password shorter than 6 characters is rejected", async () => {
    const res = await api.post("/api/auth/register").send({
      name: "Short Pwd",
      email: uniqueEmail("short"),
      password: "12345",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — name shorter than 3 characters is rejected", async () => {
    const res = await api.post("/api/auth/register").send({
      name: "AB",
      email: uniqueEmail("shortname"),
      password: "Password123!",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — empty request body returns validation error", async () => {
    const res = await api.post("/api/auth/register").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe("Auth — Login POST /api/auth/login", () => {
  const testEmail = uniqueEmail("login");
  const testPassword = "Password123!";
  const testName = "Login User";

  afterAll(async () => {
    await cleanUsers(testEmail);
  });

  // Register a user for login tests
  async function ensureUser() {
    await api.post("/api/auth/register").send({
      name: testName,
      email: testEmail,
      password: testPassword,
    });
  }

  it("200 — successful login returns accessToken and user data", async () => {
    await ensureUser();
    const res = await api
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.user).toMatchObject({
      id: expect.any(String),
      name: testName,
      email: testEmail.toLowerCase(),
    });
  });

  it("200 — password is never exposed in login response", async () => {
    await ensureUser();
    const res = await api
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    expect(res.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("401 — wrong password is rejected", async () => {
    await ensureUser();
    const res = await api
      .post("/api/auth/login")
      .send({ email: testEmail, password: "WrongPassword!" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    // Must NOT reveal whether email exists
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  it("401 — nonexistent user is rejected with same error as wrong password", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: "nobody@nowhere.invalid", password: "SomePassword123!" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  it("400 — missing email is rejected", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ password: testPassword });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — missing password is rejected", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: testEmail });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — invalid email format is rejected", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: "not-email", password: testPassword });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("400 — empty body is rejected", async () => {
    const res = await api.post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe("Auth — GET /api/auth/me", () => {
  const testEmail = uniqueEmail("me");
  const testPassword = "Password123!";
  let testToken: string;

  afterAll(async () => {
    await cleanUsers(testEmail);
  });

  async function ensureToken() {
    if (testToken) return;
    await api.post("/api/auth/register").send({
      name: "Me User",
      email: testEmail,
      password: testPassword,
    });
    const login = await api
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });
    testToken = login.body.data.accessToken;
  }

  it("200 — authenticated request returns safe user profile", async () => {
    await ensureToken();
    const res = await api
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${testToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: expect.any(String),
      email: testEmail.toLowerCase(),
    });
    expect(res.body.data.password).toBeUndefined();
  });

  it("401 — unauthenticated request is rejected", async () => {
    const res = await api.get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("401 — malformed JWT is rejected", async () => {
    const res = await api
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.valid.jwt");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("401 — empty Bearer token is rejected", async () => {
    const res = await api
      .get("/api/auth/me")
      .set("Authorization", "Bearer ");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("401 — wrong scheme (Basic auth) is rejected", async () => {
    const res = await api
      .get("/api/auth/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
