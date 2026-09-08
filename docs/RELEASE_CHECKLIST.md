# ExpenseIQ Backend — Production Release Checklist

This release checklist must be completed prior to deploying new versions of the ExpenseIQ backend to production environments.

---

## 1. Code & Build Verification

- [ ] Prisma schema validated successfully (`npx prisma validate`).
- [ ] Prisma Client code generated (`npx prisma generate`).
- [ ] TypeScript strict mode compilation succeeds with zero errors (`npm run typecheck`).
- [ ] Full Vitest suite passes without errors or skipped tests (`npm test`).
- [ ] Production build succeeds (`npm run build`).
- [ ] Dependency security audit verified (`npm audit`).

---

## 2. Database & Migrations

- [ ] Database backup snapshot created (`pg_dump`).
- [ ] Pending Prisma migrations reviewed (`npx prisma status`).
- [ ] Production migrations executed safely using `npx prisma migrate deploy` (Never use `prisma db push` in production).

---

## 3. Environment & Configuration

- [ ] Production `.env` file present and non-empty.
- [ ] `NODE_ENV` set to `production`.
- [ ] `DATABASE_URL` configured with SSL connection parameters (`sslmode=require`).
- [ ] `JWT_ACCESS_SECRET` explicitly configured with a high-entropy 256-bit key (Not using default fallback secret).
- [ ] `CORS_ORIGIN` set to exact production frontend URL(s).
- [ ] `PORT` configured.

---

## 4. Security & Hardening

- [ ] HTTPS / SSL termination configured at reverse proxy / load balancer layer.
- [ ] Cookie attributes verified (`httpOnly`, `sameSite: "strict"`, `secure: true`).
- [ ] Rate limiting enabled for `/api/auth/login`, `/api/auth/register`, password changes, and account deletion.
- [ ] Security headers verified (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`).
- [ ] Error sanitization verified (No stack traces or database error details returned in HTTP responses).

---

## 5. Operations & Health Checks

- [ ] Liveness probe verified (`GET /health/live` returns 200).
- [ ] Readiness probe verified (`GET /health/ready` returns 200 with database status `connected`).
- [ ] Operational metrics verified (`GET /metrics`).
- [ ] Graceful shutdown signal handling (`SIGTERM` / `SIGINT`) tested.

---

## 6. Post-Deployment Functional Smoke Test

- [ ] Authentication: Register / Login / Access Token / Refresh Token cycle succeeds.
- [ ] Categories: Fetch user categories (`GET /api/categories`).
- [ ] Transactions: Create and list transaction (`POST /api/transactions`).
- [ ] Reports: Generate summary report (`GET /api/reports/summary`).
- [ ] Exports: Generate CSV export (`GET /api/exports/transactions?format=csv`).
- [ ] Documentation: Fetch OpenAPI specification (`GET /docs` or `GET /api/docs`).
- [ ] Notifications: Fetch unread count (`GET /api/notifications/unread-count`).
