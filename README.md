# ExpenseIQ Backend API

A production-grade, modular, and lightweight personal finance management REST API built with Node.js 22, Express, TypeScript (strict mode), Prisma 6, PostgreSQL, Zod validation, and JWT authentication with HTTP-only refresh tokens.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [System Requirements](#system-requirements)
- [Installation & Local Setup](#installation--local-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup & Migrations](#database-setup--migrations)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Health & Operational Probes](#health--operational-probes)
- [Security & Hardening](#security--hardening)
- [Graceful Shutdown](#graceful-shutdown)
- [Cron & Job Automation](#cron--job-automation)
- [Containerization](#containerization)
- [Deployment & Operations](#deployment--operations)

---

## Features

- **Authentication & Sessions**: Secure signup/login with bcrypt, short-lived JWT access tokens, HTTP-only refresh tokens, session rotation, reuse detection, and global logout (`/api/auth/*`).
- **User Profile & Settings**: Profile management, bcrypt password updates, customizable preferences (`currency`, budget thresholds, theme), and cascade account deletion (`/api/users/*`).
- **Custom Categories**: Multi-tenant CRUD operations for `EXPENSE` & `INCOME` categories with compound user uniqueness (`/api/categories/*`).
- **Transactions**: Currency decimal precision, type-matching verification, date-range filtering, pagination, and protected category deletion (`/api/transactions/*`).
- **Budgets**: Overall and Category-specific budget tracking across `MONTHLY`, `WEEKLY`, and `CUSTOM` periods with dynamic real-time spending calculations (`/api/budgets/*`).
- **Recurring Transactions**: Automated `DAILY`, `WEEKLY`, `MONTHLY`, and `YEARLY` frequency schedules with leap-year clamping, month-end anchoring, atomic catch-up generation, and pause/resume capabilities (`/api/recurring-transactions/*`).
- **Financial Goals**: Savings targets with contribution history tracking, runtime progress metrics (`progressPercentage`, `remainingAmount`, `daysRemaining`), and status progression (`/api/goals/*`).
- **Dashboard & Analytics**: Executive financial summary, 12-month trend analysis, category spending distribution, and rule-based budget alerts (`/api/dashboard/*`).
- **Reports & Financial Analytics**: Comprehensive cash-flow summaries, period grouping (`day`, `week`, `month`), category breakdown, budget utilization, and savings performance (`/api/reports/*`).
- **Advanced Export & Data Portability**: Custom CSV & JSON data exports for transactions and summary reports with multi-tenant data isolation (`/api/exports/*`).
- **Notifications & Financial Alerts**: In-app alerts for budget warnings, goal milestones, and due recurring transaction reminders (`/api/notifications/*`).
- **Operational Health & Observability**: Dedicated `/health`, `/health/live` (process probe), `/health/ready` (DB probe), `/metrics` (uptime, request/error counts), request correlation IDs (`X-Request-ID`), and structured JSON logging.

---

## Tech Stack

- **Runtime**: Node.js v22 LTS
- **Language**: TypeScript v5.7 (Strict Mode, `NodeNext`)
- **Web Framework**: Express.js v4.21
- **Database**: PostgreSQL (v14+)
- **ORM**: Prisma ORM v6.4
- **Validation**: Zod v3.24
- **Security & Auth**: `jsonwebtoken`, `bcryptjs`, `cors`, `helmet`, `express-rate-limit`, `cookie-parser`
- **Testing**: Vitest v4.1, Supertest v7.2

---

## Architecture

The ExpenseIQ backend follows a clean, 3-layer decoupled architectural flow:

```text
HTTP Request
     │
     ▼
[Middlewares] (Request ID → Request Logger → Security Headers → CORS/Parsers → Auth)
     │
     ▼
[Routes] (URL Path & Method Routing)
     │
     ▼
[Validators] (Zod Input Schema Validation)
     │
     ▼
[Controllers] (HTTP Request/Response Handling & Status Envelopes)
     │
     ▼
[Services] (Domain Business Logic & Financial Calculations)
     │
     ▼
[Prisma ORM] (Type-Safe Query Builder)
     │
     ▼
[PostgreSQL Database] (Relational Persistence & User Isolation)
```

---

## Project Structure

```text
expenseiq-backend/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI Pipeline
├── docs/
│   ├── openapi.yaml            # OpenAPI 3.0 API Specification
│   ├── DEPLOYMENT.md           # Production Deployment Guide
│   ├── BACKUP_RESTORE.md       # PostgreSQL Backup & Restore Guide
│   ├── API_ERRORS.md           # Standard API Error Contract
│   └── RELEASE_CHECKLIST.md    # Pre-Deployment Release Checklist
├── prisma/
│   ├── migrations/             # Production Migration Files
│   └── schema.prisma           # Prisma Database Models & Indexes
├── src/
│   ├── config/                 # App Lifecycle State, Env & Prisma Instances
│   ├── controllers/            # Request Handlers
│   ├── jobs/                   # Automated Cron Tasks
│   ├── middlewares/            # Auth, Correlation, Security, Logger & Rate Limiters
│   ├── routes/                 # Express Router Definitions
│   ├── services/               # Core Business Logic & Data Access
│   ├── utils/                  # Structured Logger, Metrics, Response Formatters
│   ├── validators/             # Zod Validation Schemas
│   ├── app.ts                  # Middleware & Route Assembly
│   └── server.ts               # Server Bootstrap & Graceful Shutdown
├── tests/                      # Vitest Integration Test Suites
├── Dockerfile                  # Production Multi-Stage Dockerfile
├── .dockerignore               # Docker Build Exclusions
├── .env.example                # Environment Configuration Template
├── tsconfig.json               # TypeScript Compiler Configuration
└── README.md                   # Application Manual
```

---

## System Requirements

- **Node.js**: v20.x or v22.x LTS
- **npm**: v10.x+
- **PostgreSQL**: v14, v15, or v16
- **Git**: v2.x+

---

## Installation & Local Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/vaibhav16092008/expense_backend.git
   cd expense_backend
   ```

2. **Install Dependencies**:
   ```bash
   npm ci
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```

---

## Environment Configuration

Refer to [`.env.example`](file:///.env.example) for detailed environment settings:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Application mode (`development`, `test`, `production`) | `development` |
| `PORT` | HTTP Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/expenseiq` |
| `JWT_ACCESS_SECRET` | Secret key for access tokens | High entropy secret string |
| `CORS_ORIGIN` | Allowed client origins | `http://localhost:3000` |
| `CRON_RECURRING_ENABLED` | Enable automated cron job | `true` |
| `CRON_RECURRING_SCHEDULE` | Cron pattern | `0 0 * * *` |

---

## Database Setup & Migrations

```bash
# 1. Validate Prisma schema
npx prisma validate

# 2. Generate Prisma Client
npx prisma generate

# 3. Apply migrations in local development
npx prisma migrate dev

# 4. Apply migrations in production
npx prisma migrate deploy
```

---

## Running the Application

- **Development Mode (with auto-reload)**:
  ```bash
  npm run dev
  ```

- **Production Build & Start**:
  ```bash
  # Compile TypeScript
  npm run build

  # Launch compiled JavaScript server
  npm start
  ```

---

## Testing

```bash
# Run full Vitest integration suite once
npm test

# Run Vitest in watch mode
npm run test:watch

# Execute TypeScript typecheck
npm run typecheck
```

---

## API Documentation

- **OpenAPI 3.0 Spec**: Found in [`docs/openapi.yaml`](file:///docs/openapi.yaml).
- **OpenAPI Specification Endpoints**: `GET /docs` or `GET /api/docs` serve the complete OpenAPI 3.0 specification directly in `application/yaml` format.
- **API Error Contract**: Detailed in [`docs/API_ERRORS.md`](file:///docs/API_ERRORS.md).

---

## Health & Operational Probes

| Endpoint | Purpose | Description |
| :--- | :--- | :--- |
| `GET /health` | Application Health | General app availability |
| `GET /health/live` | Liveness Probe | Verifies Node.js process responsiveness |
| `GET /health/ready` | Readiness Probe | Verifies DB connectivity (`SELECT 1`) & readiness state |
| `GET /metrics` | Basic Metrics | Exposes process `uptimeSeconds`, `requestCount`, `errorCount` |

---

## Security & Hardening

- **User Isolation**: All database queries enforce explicit `userId` scoping.
- **Request Correlation**: Native `crypto.randomUUID()` attached as `X-Request-ID`.
- **Security Headers**: `Helmet` & custom headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`).
- **Rate Limiting**: Protected authentication & user settings routes against brute force attacks.
- **Error Sanitization**: Production errors return sanitized messages with internal details redacted.

---

## Graceful Shutdown

On receiving `SIGTERM` or `SIGINT`, the application initiates a graceful shutdown sequence:
1. Sets app state to `SHUTTING_DOWN` (Readiness probe returns 503).
2. Stops recurring transaction cron tasks.
3. Closes HTTP listener to reject new connections.
4. Allows active requests up to 10 seconds to finish.
5. Disconnects Prisma database client cleanly.

---

## Cron & Job Automation

Integrated in-process `node-cron` runner handles daily due recurring transactions and notification events safely with concurrency locking to prevent overlapping job runs.

---

## Containerization

Build and run using Docker:

```bash
# Build multi-stage image
docker build -t expenseiq-backend .

# Run container
docker run -d -p 5000:5000 --env-file .env expenseiq-backend
```

---

## Deployment & Operations

For complete production deployment instructions, backup strategies, and deployment checklists, see:
- [Production Deployment Guide](file:///docs/DEPLOYMENT.md)
- [PostgreSQL Backup & Restore Guide](file:///docs/BACKUP_RESTORE.md)
- [Pre-Deployment Release Checklist](file:///docs/RELEASE_CHECKLIST.md)
