import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { setAppState } from "../../src/config/appState.js";

const api = request(app);

describe("Health, Liveness & Readiness Endpoints", () => {
  describe("GET /health & GET /api/health", () => {
    it("200 — returns application health status without authentication", async () => {
      const res = await api.get("/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("ExpenseIQ API is healthy");
      expect(res.body.data.status).toBe("ok");
    });

    it("200 — /api/health retains backward compatibility", async () => {
      const res = await api.get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("ExpenseIQ API is healthy");
    });
  });

  describe("GET /health/live & GET /api/health/live", () => {
    it("200 — liveness probe returns process status without DB dependency", async () => {
      const res = await api.get("/health/live");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ok");
      expect(typeof res.body.data.uptimeSeconds).toBe("number");
    });
  });

  describe("GET /health/ready & GET /api/health/ready", () => {
    it("200 — readiness probe succeeds when app is ready and DB is connected", async () => {
      setAppState("READY");
      const res = await api.get("/health/ready");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("ok");
      expect(res.body.data.database).toBe("connected");
    });

    it("503 — readiness probe returns 503 when app is shutting down", async () => {
      setAppState("SHUTTING_DOWN");
      const res = await api.get("/health/ready");
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("shutting down");

      // Reset state back to READY for remaining tests
      setAppState("READY");
    });
  });

  describe("GET /metrics & GET /api/metrics", () => {
    it("200 — returns basic system operational metrics", async () => {
      const res = await api.get("/metrics");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.uptimeSeconds).toBe("number");
      expect(typeof res.body.data.requestCount).toBe("number");
      expect(typeof res.body.data.errorCount).toBe("number");
    });
  });
});
