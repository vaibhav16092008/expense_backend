/**
 * Security & Hardening — focused integration test suite.
 *
 * Covers:
 *   - Security Headers (Helmet headers present)
 *   - CORS Configuration (Allowed origins)
 *   - Production Environment Secret Enforcement
 *   - Invalid & Expired JWT Rejection
 *   - Rate Limiting Headers & Threshold Behavior
 *   - Request Body Size Limits (100KB limit)
 *   - Production-safe Error Sanitization (no internal leakages)
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { validateEnv } from "../../src/config/env.js";

const api = request(app);

// ===========================================================================
// 1. SECURITY HEADERS (HELMET)
// ===========================================================================

describe("Security Headers (Helmet)", () => {
  it("GET /api/health returns essential security headers", async () => {
    const res = await api.get("/api/health");
    expect(res.status).toBe(200);

    // Verify key Helmet security headers
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});

// ===========================================================================
// 2. CORS HARDENING
// ===========================================================================

describe("CORS Hardening", () => {
  it("OPTIONS /api/health returns access-control-allow-origin header", async () => {
    const res = await api
      .options("/api/health")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });
});

// ===========================================================================
// 3. PRODUCTION ENVIRONMENT SECRET ENFORCEMENT
// ===========================================================================

describe("Production Environment Secret Enforcement", () => {
  it("validateEnv('development') succeeds with defaults", () => {
    expect(() => validateEnv("development")).not.toThrow();
  });

  it("validateEnv('production') throws if JWT secret is fallback default", () => {
    expect(() =>
      validateEnv(
        "production",
        "default_jwt_secret_change_in_production",
        "postgres://localhost:5432/db"
      )
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("validateEnv('production') succeeds with valid production secret and db url", () => {
    expect(() =>
      validateEnv(
        "production",
        "super_secret_prod_jwt_key_9999",
        "postgres://localhost:5432/db"
      )
    ).not.toThrow();
  });
});

// ===========================================================================
// 4. INVALID / EXPIRED JWT REJECTION
// ===========================================================================

describe("Authentication Security", () => {
  it("GET /api/users/me with malformed JWT → 401", async () => {
    const res = await api
      .get("/api/users/me")
      .set("Authorization", "Bearer malformed.token.string");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid or expired token/i);
  });

  it("GET /api/users/me with no Bearer prefix → 401", async () => {
    const res = await api
      .get("/api/users/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// 5. RATE LIMITING HEADERS & THRESHOLD EXCEEDED
// ===========================================================================

describe("Rate Limiting Configuration", () => {
  it("POST /api/auth/login includes rate limit headers", async () => {
    const res = await api
      .post("/api/auth/login")
      .set("x-enable-rate-limit", "true")
      .send({
        email: "nobody@example.com",
        password: "wrongpassword",
      });

    // Rate limiter headers must be active
    const hasRateLimitHeader =
      res.headers["ratelimit-limit"] !== undefined ||
      res.headers["x-ratelimit-limit"] !== undefined;
    expect(hasRateLimitHeader).toBe(true);
  });

  it("exceeding rate limit returns 429 Too Many Requests", async () => {
    // Send 11 requests with rate limiting explicitly enabled
    let lastStatus = 0;
    let lastBody = null;

    for (let i = 0; i < 11; i++) {
      const res = await api
        .post("/api/auth/login")
        .set("x-enable-rate-limit", "true")
        .send({
          email: `ratelimit_${i}@example.com`,
          password: "password123",
        });
      lastStatus = res.status;
      lastBody = res.body;
    }

    expect(lastStatus).toBe(429);
    expect(lastBody?.success).toBe(false);
    expect(lastBody?.message).toMatch(/Too many authentication attempts/i);
  });
});

// ===========================================================================
// 6. REQUEST BODY SIZE LIMIT (100KB)
// ===========================================================================

describe("Request Body Size Limit", () => {
  it("POST with payload > 100KB → 413 Payload Too Large", async () => {
    // Create a 150KB string payload
    const largePayload = {
      name: "A".repeat(150 * 1024),
    };

    const res = await api.post("/api/auth/register").send(largePayload);
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("100kb");
  });
});

// ===========================================================================
// 7. PRODUCTION ERROR SANITIZATION
// ===========================================================================

describe("Error Sanitization", () => {
  it("GET 404 route returns structured json error without stack trace or paths", async () => {
    const res = await api.get("/api/non-existent-route-xyz");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Route not found");
    expect(res.body.stack).toBeUndefined();
    expect(res.body.path).toBeUndefined();
  });
});
