import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { sanitizeMetadata } from "../../src/utils/logger.js";

const api = request(app);

describe("Phase 8 — Operational Hardening & Request Correlation", () => {
  describe("Request Correlation ID System", () => {
    it("automatically generates UUID X-Request-ID if missing", async () => {
      const res = await api.get("/health");
      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toBeDefined();
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("reuses client-provided X-Request-ID header", async () => {
      const customId = "custom-client-req-99999";
      const res = await api.get("/health").set("X-Request-ID", customId);
      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toBe(customId);
    });

    it("generates separate unique IDs for consecutive requests", async () => {
      const res1 = await api.get("/health");
      const res2 = await api.get("/health");
      expect(res1.headers["x-request-id"]).not.toBe(res2.headers["x-request-id"]);
    });
  });

  describe("Security Headers Hardening", () => {
    it("returns required production security headers on API requests", async () => {
      const res = await api.get("/health");
      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    });
  });

  describe("Sensitive Metadata Redaction", () => {
    it("redacts sensitive keys from log metadata", () => {
      const inputMeta = {
        user: "testuser",
        password: "secretpassword123",
        token: "jwt.token.val",
        authorization: "Bearer 12345",
        cookie: "session=xyz",
        nested: {
          refreshToken: "refresh.token.val",
          safeKey: "safeValue",
        },
      };

      const sanitized = sanitizeMetadata(inputMeta) as Record<string, unknown>;

      expect(sanitized.user).toBe("testuser");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.cookie).toBe("[REDACTED]");

      const nestedObj = sanitized.nested as Record<string, unknown>;
      expect(nestedObj.refreshToken).toBe("[REDACTED]");
      expect(nestedObj.safeKey).toBe("safeValue");
    });
  });
});
