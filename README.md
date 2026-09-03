# ExpenseIQ Server

ExpenseIQ Backend API — A production-quality, modular, and lightweight personal finance management REST API built with Node.js, Express, TypeScript, Prisma 6.x, PostgreSQL, Zod validation, and JWT authentication.

---

## 1. Project Overview

ExpenseIQ is an intelligent expense management platform engineered for seamless multi-client support (Web & Mobile). The backend provides a secure, ownership-driven architecture for tracking personal cash flows, category-wise budgets, analytics, and future AI-driven spending recommendations.

### Current Features
* **API Health & DB Monitoring**: Endpoints to check server lifecycle and PostgreSQL database connectivity.
* **User Registration**: Secure registration with Zod validation, duplicate email prevention, and bcrypt password hashing (10 salt rounds).
* **User Authentication & Login**: Safe credential verification returning JWT access tokens with structured user payloads.
* **Protected Routes & Current User Profile**: JWT authentication middleware extracting token claims and serving `/api/auth/me`.
* **User-Created Custom Categories**: Full CRUD endpoints (`POST`, `GET`, `GET /:id`, `PATCH`, `DELETE`) with type filtering (`EXPENSE` & `INCOME`), compound uniqueness per user, and strict multi-tenant ownership isolation.
* **Transactions Management**: Full CRUD (`POST`, `GET`, `GET /:id`, `PATCH`, `DELETE`) with decimal precision for currency, category type consistency enforcement, multi-attribute filtering (type, category, date ranges), newest-first sorting (`date DESC, createdAt DESC`), and protected category deletion.
* **Budgets Module**: Full CRUD (`POST`, `GET`, `GET /:id`, `PATCH`, `DELETE`) supporting `OVERALL` and `CATEGORY` budgets across `MONTHLY`, `WEEKLY`, and `CUSTOM` periods with dynamic real-time spending calculations (`spent`, `remaining`, `percentage`, `status`, `isActive`), overlap detection, and category deletion protection.
* **Dashboard & Analytics Module**: Production-ready chart-ready endpoints (`/api/dashboard/summary`, `/api/dashboard/monthly`, `/api/dashboard/categories`, `/api/dashboard/trends`, `/api/dashboard/budget-overview`) providing total cash flows, savings rates, previous-period comparisons, 12-month analytics, granular time-series spending trends, rule-based deterministic insights, and alerts.
* **Recurring Transactions Module**: Full schedule management (`POST`, `GET`, `GET /:id`, `PATCH`, `DELETE`, `POST /:id/pause`, `POST /:id/resume`, `POST /process`) supporting `DAILY`, `WEEKLY`, `MONTHLY`, and `YEARLY` frequencies with month-end anchor preservation, leap-year clamping, atomic catch-up generation of missed occurrences, database-level duplicate prevention, and seamless Budget/Dashboard integration.
* **Financial Goals Module**: Full savings goals & contribution tracking system (`POST`, `GET`, `GET /summary`, `GET /:id`, `PATCH`, `DELETE`, `POST /:id/pause`, `POST /:id/resume`, `POST /:id/complete`, `POST /:id/contributions`, `GET /:id/contributions`, `DELETE /:goalId/contributions/:contributionId`) with atomic increment/decrement transactions, non-persisted runtime calculations (`remainingAmount`, `progressPercentage`, `daysRemaining`, `derivedStatus`), aggregate summaries, top-goal tie-breaking, and strict multi-tenant isolation.
* **User Profile & Settings Module**: Complete profile management, secure bcrypt password change, application settings & preferences (`currency`, `monthlyBudgetEnabled`, `monthlyBudgetAmount`, `budgetAlertsEnabled`, `recurringRemindersEnabled`, `goalRemindersEnabled`, `theme`), auto-upserted user settings, password-verified account deletion, and full database cascade teardown (`/api/users/me`, `/api/users/me/password`, `/api/users/settings`).
* **Zero Password Leakage**: Passwords and sensitive internal details are stripped at the database/service layer.
* **Strict Error Handling**: Global middleware formatting errors without leaking database internals, SQL, or stack traces.

### Planned Features (Future Modules)
* Real-time spending warnings and push/email notifications
* AI-powered spending insights, anomaly detection, and budget forecasting
* Recurring budgets and financial reporting exports

---

## 2. Tech Stack

* **Runtime**: Node.js 22+
* **Language**: TypeScript (Strict Mode, `NodeNext`)
* **Framework**: Express.js
* **Database**: PostgreSQL
* **ORM**: Prisma ORM (v6.x)
* **Authentication & Security**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `cors`
* **Schema Validation**: Zod
* **Environment**: `dotenv`

---

## 3. Project Structure

```text
expenseiq-server/
│
├── prisma/
│   ├── migrations/             # Generated database migration files
│   └── schema.prisma           # Prisma 6 schema (User & Category models)
│
├── src/
│   ├── config/
│   │   ├── env.ts              # Environment variables loader
│   │   └── prisma.ts           # Singleton Prisma Client instance
│   │
│   ├── controllers/
│   │   └── auth.controller.ts  # Request handlers for auth endpoints
│   │
│   ├── services/
│   │   └── auth.service.ts     # Business logic, password hashing & DB operations
│   │
│   ├── routes/
│   │   ├── auth.routes.ts      # Authentication routes (/api/auth)
│   │   └── health.routes.ts    # Health check routes (/api/health)
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts  # JWT Bearer token authentication
│   │   └── error.middleware.ts # 404 handler & global error handler
│   │
│   ├── validators/
│   │   └── auth.validator.ts   # Zod validation schemas for auth inputs
│   │
│   ├── utils/
│   │   ├── token.ts            # JWT sign and verify utilities
│   │   └── response.ts         # Standardized API response formatters
│   │
│   ├── app.ts                  # Express application configuration
│   └── server.ts               # Server bootstrap & listener
│
├── .env                        # Local environment file (never committed)
├── .env.example                # Example environment template
├── .gitignore                  # Git ignore rules
├── package.json                # Project dependencies & npm scripts
├── tsconfig.json               # TypeScript strict configuration
└── README.md                   # Project documentation
```

---

## 4. Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```env
PORT=5000
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/expenseiq?schema=public"
JWT_ACCESS_SECRET=replace_with_strong_secret
JWT_ACCESS_EXPIRES_IN=7d
NODE_ENV=development
```

---

## 5. Getting Started

### Prerequisites
* **Node.js**: v22.x or higher
* **npm**: v10.x or higher
* **PostgreSQL**: v13+ running locally or in the cloud

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials and JWT secret
   ```

3. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

4. Generate Prisma Client:
   ```bash
   npm run prisma:generate
   ```

### Development Server

Start the development server with live reload:
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

---

## 6. NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts server with `tsx watch` for hot-reloading |
| `npm run build` | Compiles TypeScript code to `dist/` |
| `npm run start` | Runs the compiled production code from `dist/server.js` |
| `npm run typecheck` | Validates TypeScript types across the project |
| `npm run prisma:generate` | Generates the Prisma Client |
| `npm run prisma:migrate` | Runs Prisma development migrations against the database |
| `npm run prisma:studio` | Opens Prisma Studio GUI in the browser |

---

## 7. API Reference

All responses follow a consistent JSON format:
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### Health Endpoints

#### 1. Server Health Check
* **Method**: `GET`
* **URL**: `/api/health`
* **Auth**: None
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "ExpenseIQ API is healthy"
  }
  ```

#### 2. Database Health Check
* **Method**: `GET`
* **URL**: `/api/health/db`
* **Auth**: None
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Database connection is healthy"
  }
  ```

---

### Authentication Endpoints

#### 1. Register User
* **Method**: `POST`
* **URL**: `/api/auth/register`
* **Auth**: None
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "name": "Vaibhav",
    "email": "vaibhav@gmail.com",
    "password": "strongPassword123"
  }
  ```
* **Validation Rules**:
  * `name`: minimum 3 characters
  * `email`: valid email format
  * `password`: minimum 6 characters
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "name": "Vaibhav",
      "email": "vaibhav@gmail.com",
      "createdAt": "2026-08-24T14:55:00.000Z",
      "updatedAt": "2026-08-24T14:55:00.000Z"
    }
  }
  ```

#### 2. Login User
* **Method**: `POST`
* **URL**: `/api/auth/login`
* **Auth**: None
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "email": "vaibhav@gmail.com",
    "password": "strongPassword123"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
        "name": "Vaibhav",
        "email": "vaibhav@gmail.com"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### 3. Get Current User Profile
* **Method**: `GET`
* **URL**: `/api/auth/me`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Headers**: `Authorization: Bearer <accessToken>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User fetched successfully",
    "data": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "name": "Vaibhav",
      "email": "vaibhav@gmail.com"
    }
  }
  ```

---

### Category Endpoints

#### 1. Create Category
* **Method**: `POST`
* **URL**: `/api/categories`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Request Body**:
  ```json
  {
    "name": "Food",
    "type": "EXPENSE"
  }
  ```
* **Validation Rules**:
  * `name`: string, trimmed, 2-50 characters
  * `type`: `EXPENSE` or `INCOME`
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Category created successfully",
    "data": {
      "id": "4bb9b82e-42d3-4da7-b23d-f6cd78c98775",
      "name": "Food",
      "type": "EXPENSE",
      "userId": "06a1c724-4e09-4bcb-bfc3-3a5dbf6b35f3",
      "createdAt": "2026-08-24T12:21:49.366Z",
      "updatedAt": "2026-08-24T12:21:49.366Z"
    }
  }
  ```

#### 2. Get All Categories (with optional filtering)
* **Method**: `GET`
* **URL**: `/api/categories` (or `/api/categories?type=EXPENSE`, `/api/categories?type=INCOME`)
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Categories fetched successfully",
    "data": [
      {
        "id": "4bb9b82e-42d3-4da7-b23d-f6cd78c98775",
        "name": "Food",
        "type": "EXPENSE",
        "userId": "06a1c724-4e09-4bcb-bfc3-3a5dbf6b35f3",
        "createdAt": "2026-08-24T12:21:49.366Z",
        "updatedAt": "2026-08-24T12:21:49.366Z"
      }
    ]
  }
  ```

#### 3. Get Single Category by ID
* **Method**: `GET`
* **URL**: `/api/categories/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Category fetched successfully",
    "data": {
      "id": "4bb9b82e-42d3-4da7-b23d-f6cd78c98775",
      "name": "Food",
      "type": "EXPENSE",
      "userId": "06a1c724-4e09-4bcb-bfc3-3a5dbf6b35f3",
      "createdAt": "2026-08-24T12:21:49.366Z",
      "updatedAt": "2026-08-24T12:21:49.366Z"
    }
  }
  ```

#### 4. Update Category
* **Method**: `PATCH`
* **URL**: `/api/categories/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Request Body**:
  ```json
  {
    "name": "Dining Out"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Category updated successfully",
    "data": {
      "id": "4bb9b82e-42d3-4da7-b23d-f6cd78c98775",
      "name": "Dining Out",
      "type": "EXPENSE",
      "userId": "06a1c724-4e09-4bcb-bfc3-3a5dbf6b35f3",
      "createdAt": "2026-08-24T12:21:49.366Z",
      "updatedAt": "2026-08-24T12:21:49.439Z"
    }
  }
  ```

#### 5. Delete Category
* **Method**: `DELETE`
* **URL**: `/api/categories/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Category deleted successfully"
  }
  ```
* **Protection**: Returns `409 Conflict` if the category has associated transactions to prevent accidental loss of financial records.

---

### Transaction Endpoints

#### 1. Create Transaction
* **Method**: `POST`
* **URL**: `/api/transactions`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "amount": 250,
    "type": "EXPENSE",
    "categoryId": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
    "note": "Lunch with colleagues",
    "date": "2026-08-20"
  }
  ```
* **Validation & Business Rules**:
  * `amount`: positive numeric value (> 0, stored accurately via Decimal)
  * `type`: `EXPENSE` | `INCOME` (must match category's type)
  * `categoryId`: valid UUID belonging to authenticated user
  * `note`: optional trimmed string (max 500 characters)
  * `date`: valid date / ISO string
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Transaction created successfully",
    "data": {
      "id": "e0d90cec-0267-4d56-80d3-c9a286688a60",
      "amount": "250.00",
      "type": "EXPENSE",
      "category": {
        "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
        "name": "Food",
        "type": "EXPENSE"
      },
      "note": "Lunch with colleagues",
      "date": "2026-08-20T00:00:00.000Z",
      "createdAt": "2026-08-24T12:53:39.055Z",
      "updatedAt": "2026-08-24T12:53:39.055Z"
    }
  }
  ```

#### 2. Get Transactions (with Filters & Sorting)
* **Method**: `GET`
* **URL**: `/api/transactions`
* **Query Parameters**:
  * `type`: `EXPENSE` | `INCOME`
  * `categoryId`: UUID
  * `startDate`: `YYYY-MM-DD` (inclusive start of day `00:00:00.000Z`)
  * `endDate`: `YYYY-MM-DD` (inclusive end of day `23:59:59.999Z`)
* **Sorting**: Defaults to `date DESC, createdAt DESC` (newest transactions first)
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Transactions fetched successfully",
    "data": [
      {
        "id": "e0d90cec-0267-4d56-80d3-c9a286688a60",
        "amount": "250.00",
        "type": "EXPENSE",
        "category": {
          "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
          "name": "Food",
          "type": "EXPENSE"
        },
        "note": "Lunch with colleagues",
        "date": "2026-08-20T00:00:00.000Z",
        "createdAt": "2026-08-24T12:53:39.055Z",
        "updatedAt": "2026-08-24T12:53:39.055Z"
      }
    ]
  }
  ```

#### 3. Get Single Transaction by ID
* **Method**: `GET`
* **URL**: `/api/transactions/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Transaction fetched successfully",
    "data": {
      "id": "e0d90cec-0267-4d56-80d3-c9a286688a60",
      "amount": "250.00",
      "type": "EXPENSE",
      "category": {
        "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
        "name": "Food",
        "type": "EXPENSE"
      },
      "note": "Lunch with colleagues",
      "date": "2026-08-20T00:00:00.000Z",
      "createdAt": "2026-08-24T12:53:39.055Z",
      "updatedAt": "2026-08-24T12:53:39.055Z"
    }
  }
  ```

#### 4. Update Transaction
* **Method**: `PATCH`
* **URL**: `/api/transactions/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Request Body** (at least one field required):
  ```json
  {
    "amount": 300,
    "note": "Buffet lunch with team"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Transaction updated successfully",
    "data": {
      "id": "e0d90cec-0267-4d56-80d3-c9a286688a60",
      "amount": "300.00",
      "type": "EXPENSE",
      "category": {
        "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
        "name": "Food",
        "type": "EXPENSE"
      },
      "note": "Buffet lunch with team",
      "date": "2026-08-20T00:00:00.000Z",
      "createdAt": "2026-08-24T12:53:39.055Z",
      "updatedAt": "2026-08-24T12:53:39.128Z"
    }
  }
  ```

#### 5. Delete Transaction
* **Method**: `DELETE`
* **URL**: `/api/transactions/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Transaction deleted successfully"
  }
  ```

---

### Budget Endpoints

#### 1. Create Budget
* **Method**: `POST`
* **URL**: `/api/budgets`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Headers**: `Content-Type: application/json`

**Overall Budget Request Example**:
```json
{
  "amount": 25000,
  "type": "OVERALL",
  "period": "MONTHLY",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31"
}
```

**Category Budget Request Example**:
```json
{
  "amount": 5000,
  "type": "CATEGORY",
  "categoryId": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
  "period": "MONTHLY",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31"
}
```

* **Validation & Business Rules**:
  * `amount`: Required positive decimal (> 0).
  * `type`: `OVERALL` | `CATEGORY`.
  * `period`: `WEEKLY` | `MONTHLY` | `CUSTOM`.
  * `startDate` / `endDate`: Required valid ISO dates. `endDate >= startDate`.
  * `MONTHLY`: `startDate` must be day 1 of month; `endDate` must be the last calendar day of the same month.
  * `WEEKLY`: `endDate - startDate` must span exactly 7 calendar days.
  * `CATEGORY`: `categoryId` is **required**, must belong to authenticated user, and must be of type `EXPENSE` (budgets on `INCOME` categories are rejected with 400).
  * `OVERALL`: `categoryId` must be `null` / omitted.
  * **No Overlaps**: Overlapping budgets for the same scope (`OVERALL` or same `categoryId`) within the user account are rejected with `409 Conflict`.
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Budget created successfully",
    "data": {
      "id": "7f8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "amount": "5000.00",
      "type": "CATEGORY",
      "period": "MONTHLY",
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2026-08-31T23:59:59.999Z",
      "category": {
        "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
        "name": "Food",
        "type": "EXPENSE"
      },
      "spent": "0.00",
      "remaining": "5000.00",
      "percentage": 0,
      "status": "ON_TRACK",
      "isActive": true,
      "createdAt": "2026-08-25T12:00:00.000Z",
      "updatedAt": "2026-08-25T12:00:00.000Z"
    }
  }
  ```

#### 2. Get All Budgets (with Filtering)
* **Method**: `GET`
* **URL**: `/api/budgets`
* **Query Parameters**:
  * `type`: `OVERALL` | `CATEGORY`
  * `period`: `WEEKLY` | `MONTHLY` | `CUSTOM`
  * `categoryId`: UUID
  * `startDate`: `YYYY-MM-DD`
  * `endDate`: `YYYY-MM-DD`
  * `status`: `ON_TRACK` | `WARNING` | `CRITICAL` | `EXCEEDED`
* **Sorting**: `startDate DESC, createdAt DESC`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Budgets fetched successfully",
    "data": [
      {
        "id": "7f8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
        "amount": "5000.00",
        "type": "CATEGORY",
        "period": "MONTHLY",
        "startDate": "2026-08-01T00:00:00.000Z",
        "endDate": "2026-08-31T23:59:59.999Z",
        "category": {
          "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
          "name": "Food",
          "type": "EXPENSE"
        },
        "spent": "3200.00",
        "remaining": "1800.00",
        "percentage": 64,
        "status": "ON_TRACK",
        "isActive": true,
        "createdAt": "2026-08-25T12:00:00.000Z",
        "updatedAt": "2026-08-25T12:00:00.000Z"
      }
    ]
  }
  ```

#### 3. Get Single Budget by ID
* **Method**: `GET`
* **URL**: `/api/budgets/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Budget fetched successfully",
    "data": {
      "id": "7f8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "amount": "5000.00",
      "type": "CATEGORY",
      "period": "MONTHLY",
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2026-08-31T23:59:59.999Z",
      "category": {
        "id": "020b6d56-2c9d-4c1a-8ea6-9bfe3ccc00ef",
        "name": "Food",
        "type": "EXPENSE"
      },
      "spent": "3200.00",
      "remaining": "1800.00",
      "percentage": 64,
      "status": "ON_TRACK",
      "isActive": true,
      "createdAt": "2026-08-25T12:00:00.000Z",
      "updatedAt": "2026-08-25T12:00:00.000Z"
    }
  }
  ```

#### 4. Update Budget
* **Method**: `PATCH`
* **URL**: `/api/budgets/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Request Body** (at least one field required):
  ```json
  {
    "amount": 6000
  }
  ```
* **Validation**: Validates the merged final budget state against all business rules (overlap, ownership, category expense type, period constraints).
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Budget updated successfully",
    "data": { ... }
  }
  ```

#### 5. Delete Budget
* **Method**: `DELETE`
* **URL**: `/api/budgets/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Budget deleted successfully"
  }
  ```
* **Non-Destructive**: Deleting a budget removes only the spending goal; associated transactions remain intact.

---

### Dynamic Calculation & Budget Rules

* **Zero Derived Storage**: `spent`, `remaining`, `percentage`, `status`, and `isActive` are calculated dynamically on read from matching transactions.
* **Spending Formula**:
  * For `OVERALL`: Sum of all user transactions where `type = EXPENSE` and `date` falls inside `[startDate, endDate]`.
  * For `CATEGORY`: Sum of all user transactions where `type = EXPENSE`, `categoryId = budget.categoryId`, and `date` falls inside `[startDate, endDate]`.
  * `INCOME` transactions are never counted towards spending.
* **Remaining**: `budget.amount - spent` (can be negative during overspending; never clamped).
* **Usage Percentage**: `Math.round((spent / budget.amount) * 100)`.
* **Budget Status Tiers**:
  * `0% – 69%`: `ON_TRACK`
  * `70% – 89%`: `WARNING`
  * `90% – 99%`: `CRITICAL`
  * `100%+`: `EXCEEDED`
* **Category Deletion Protection**: Categories referenced by existing budgets cannot be deleted (`409 Conflict`).

---

### Dashboard & Analytics Endpoints

All dashboard endpoints require JWT Authentication (`Authorization: Bearer <accessToken>`) and are scoped strictly to the authenticated user.

#### 1. Financial Summary & Overview
* **Method**: `GET`
* **URL**: `/api/dashboard/summary`
* **Query Parameters**:
  * `period`: `today` | `week` | `month` (default) | `year`
  * `startDate`: `YYYY-MM-DD`
  * `endDate`: `YYYY-MM-DD`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Dashboard summary fetched successfully",
    "data": {
      "period": "month",
      "dateRange": {
        "startDate": "2026-08-01T00:00:00.000Z",
        "endDate": "2026-08-31T23:59:59.999Z"
      },
      "current": {
        "income": 50000,
        "expense": 6500,
        "balance": 43500,
        "savingsRate": 87,
        "transactionCount": 4
      },
      "previous": {
        "income": 45000,
        "expense": 4000,
        "balance": 41000,
        "savingsRate": 91.11,
        "transactionCount": 2
      },
      "comparison": {
        "incomeChangePercentage": 11.11,
        "expenseChangePercentage": 62.5,
        "balanceChangePercentage": 6.1
      },
      "recentTransactions": [
        {
          "id": "tx-uuid-1",
          "amount": "1500.00",
          "type": "EXPENSE",
          "category": "Food",
          "note": "Groceries",
          "date": "2026-08-15T00:00:00.000Z"
        }
      ],
      "topCategory": {
        "id": "cat-uuid-1",
        "name": "Food",
        "amount": 4500
      },
      "highestExpense": {
        "id": "tx-uuid-2",
        "amount": 3000,
        "category": "Food",
        "date": "2026-08-05T00:00:00.000Z"
      },
      "insights": [
        {
          "type": "SPENDING_INCREASE",
          "severity": "INFO",
          "message": "Your spending is 62.5% higher than the previous period."
        },
        {
          "type": "TOP_CATEGORY",
          "severity": "INFO",
          "message": "Food is your highest expense category (69% of total spending)."
        }
      ],
      "alerts": []
    }
  }
  ```

#### 2. Monthly Cash Flow Analytics (Chart 1: 12-Month Bar/Line Chart)
* **Method**: `GET`
* **URL**: `/api/dashboard/monthly`
* **Query Parameters**:
  * `year`: `YYYY` (default: current year)
* **Guaranteed Format**: Always returns an array of all 12 calendar months (`Jan` to `Dec`) with zero-filled defaults.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Monthly analytics fetched successfully",
    "data": {
      "year": 2026,
      "totalIncome": 95000,
      "totalExpense": 10500,
      "netSavings": 84500,
      "data": [
        { "month": "Jan", "monthIndex": 1, "income": 0, "expense": 0, "balance": 0 },
        { "month": "Feb", "monthIndex": 2, "income": 0, "expense": 0, "balance": 0 },
        { "month": "Jul", "monthIndex": 7, "income": 45000, "expense": 4000, "balance": 41000 },
        { "month": "Aug", "monthIndex": 8, "income": 50000, "expense": 6500, "balance": 43500 },
        { "month": "Dec", "monthIndex": 12, "income": 0, "expense": 0, "balance": 0 }
      ]
    }
  }
  ```

#### 3. Category Expense Breakdown (Chart 2: Pie/Donut Chart)
* **Method**: `GET`
* **URL**: `/api/dashboard/categories`
* **Query Parameters**:
  * `period`: `today` | `week` | `month` | `year`
  * `startDate`: `YYYY-MM-DD`
  * `endDate`: `YYYY-MM-DD`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Category analytics fetched successfully",
    "data": {
      "dateRange": {
        "startDate": "2026-08-01T00:00:00.000Z",
        "endDate": "2026-08-31T23:59:59.999Z"
      },
      "totalExpense": 6500,
      "categoryCount": 2,
      "data": [
        {
          "categoryId": "cat-uuid-1",
          "categoryName": "Food",
          "amount": 4500,
          "transactionCount": 2,
          "percentage": 69.23
        },
        {
          "categoryId": "cat-uuid-2",
          "categoryName": "Travel",
          "amount": 2000,
          "transactionCount": 1,
          "percentage": 30.77
        }
      ]
    }
  }
  ```

#### 4. Spending Trends (Chart 3: Time-Series Line Chart)
* **Method**: `GET`
* **URL**: `/api/dashboard/trends`
* **Query Parameters**:
  * `period`: `today` | `week` | `month` | `year`
  * `granularity`: `daily` | `weekly` | `monthly` (optional; auto-resolves to daily for $\le 31$ days, weekly for $\le 90$ days, monthly for $>90$ days)
  * `startDate`: `YYYY-MM-DD`
  * `endDate`: `YYYY-MM-DD`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Spending trends fetched successfully",
    "data": {
      "granularity": "daily",
      "dateRange": {
        "startDate": "2026-08-01T00:00:00.000Z",
        "endDate": "2026-08-31T23:59:59.999Z"
      },
      "totalExpense": 6500,
      "averageDailyExpense": 209.68,
      "highestSpendingDay": "2026-08-05",
      "highestSpendingAmount": 3000,
      "data": [
        { "date": "2026-08-01", "expense": 0 },
        { "date": "2026-08-05", "expense": 3000 },
        { "date": "2026-08-10", "expense": 2000 },
        { "date": "2026-08-15", "expense": 1500 }
      ]
    }
  }
  ```

#### 5. Budget Overview & Progress Bars (Chart 4: Budget Progress Bars)
* **Method**: `GET`
* **URL**: `/api/dashboard/budget-overview`
* **Centralized Logic**: 100% reuses the calculation and status logic from the Budget service.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Budget overview fetched successfully",
    "data": {
      "totalBudgets": 2,
      "activeBudgets": 2,
      "criticalBudgets": 0,
      "exceededBudgets": 0,
      "totalAllocated": 30000,
      "totalSpent": 11000,
      "totalRemaining": 19000,
      "overallPercentage": 37,
      "budgets": [
        {
          "id": "b-uuid-1",
          "name": "Overall Budget",
          "type": "OVERALL",
          "period": "MONTHLY",
          "amount": 25000,
          "spent": 6500,
          "remaining": 18500,
          "percentage": 26,
          "status": "ON_TRACK",
          "isActive": true
        },
        {
          "id": "b-uuid-2",
          "name": "Food",
          "type": "CATEGORY",
          "period": "MONTHLY",
          "amount": 5000,
          "spent": 4500,
          "remaining": 500,
          "percentage": 90,
          "status": "CRITICAL",
          "isActive": true
        }
      ]
    }
  }
  ```

---

### Recurring Transaction Endpoints

All recurring transaction endpoints require JWT Authentication (`Authorization: Bearer <accessToken>`) and are scoped strictly to the authenticated user.

#### 1. Create Recurring Schedule
* **Method**: `POST`
* **URL**: `/api/recurring-transactions`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Headers**: `Content-Type: application/json`
* **Request Body**:
  ```json
  {
    "amount": 8000,
    "type": "EXPENSE",
    "categoryId": "cat-uuid-rent",
    "note": "Monthly Apartment Rent",
    "frequency": "MONTHLY",
    "startDate": "2026-09-01",
    "endDate": null
  }
  ```
* **Rules**:
  * `amount`: Positive decimal (> 0).
  * `type`: `EXPENSE` | `INCOME` (must match category's type).
  * `frequency`: `DAILY` | `WEEKLY` | `MONTHLY` | `YEARLY`.
  * `startDate`: Required ISO date. Server automatically sets `nextRunAt = startDate` (does NOT automatically generate historical transactions on creation).
  * `endDate`: Optional ISO date (`endDate >= startDate`).
* **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Recurring transaction created successfully",
    "data": {
      "id": "rec-uuid-1",
      "amount": "8000.00",
      "type": "EXPENSE",
      "frequency": "MONTHLY",
      "note": "Monthly Apartment Rent",
      "startDate": "2026-09-01T00:00:00.000Z",
      "nextRunAt": "2026-09-01T00:00:00.000Z",
      "endDate": null,
      "active": true,
      "category": {
        "id": "cat-uuid-rent",
        "name": "Rent",
        "type": "EXPENSE"
      },
      "createdAt": "2026-08-25T15:00:00.000Z",
      "updatedAt": "2026-08-25T15:00:00.000Z"
    }
  }
  ```

#### 2. Get All Recurring Schedules (with Filters & Sorting)
* **Method**: `GET`
* **URL**: `/api/recurring-transactions`
* **Query Parameters**:
  * `active`: `true` | `false`
  * `type`: `EXPENSE` | `INCOME`
  * `frequency`: `DAILY` | `WEEKLY` | `MONTHLY` | `YEARLY`
  * `categoryId`: UUID
  * `startDate`: `YYYY-MM-DD`
  * `endDate`: `YYYY-MM-DD`
  * `sortBy`: `nextRunAt` (default) | `createdAt` | `amount`
  * `sortOrder`: `asc` (default) | `desc`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Recurring transactions fetched successfully",
    "data": [
      {
        "id": "rec-uuid-1",
        "amount": "8000.00",
        "type": "EXPENSE",
        "frequency": "MONTHLY",
        "note": "Monthly Apartment Rent",
        "startDate": "2026-09-01T00:00:00.000Z",
        "nextRunAt": "2026-09-01T00:00:00.000Z",
        "endDate": null,
        "active": true,
        "category": {
          "id": "cat-uuid-rent",
          "name": "Rent",
          "type": "EXPENSE"
        },
        "createdAt": "2026-08-25T15:00:00.000Z",
        "updatedAt": "2026-08-25T15:00:00.000Z"
      }
    ]
  }
  ```

#### 3. Get Single Recurring Schedule by ID
* **Method**: `GET`
* **URL**: `/api/recurring-transactions/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Recurring transaction fetched successfully",
    "data": {
      "id": "rec-uuid-1",
      "amount": "8000.00",
      "type": "EXPENSE",
      "frequency": "MONTHLY",
      "note": "Monthly Apartment Rent",
      "startDate": "2026-09-01T00:00:00.000Z",
      "nextRunAt": "2026-09-01T00:00:00.000Z",
      "endDate": null,
      "active": true,
      "category": {
        "id": "cat-uuid-rent",
        "name": "Rent",
        "type": "EXPENSE"
      },
      "createdAt": "2026-08-25T15:00:00.000Z",
      "updatedAt": "2026-08-25T15:00:00.000Z"
    }
  }
  ```

#### 4. Update Recurring Schedule
* **Method**: `PATCH`
* **URL**: `/api/recurring-transactions/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Request Body** (at least one field required):
  ```json
  {
    "amount": 8500
  }
  ```
* **Historical Protection**: Updating a schedule modifies only future occurrences; already-generated historical transactions remain untouched.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Recurring transaction updated successfully",
    "data": { ... }
  }
  ```

#### 5. Delete Recurring Schedule
* **Method**: `DELETE`
* **URL**: `/api/recurring-transactions/:id`
* **Auth**: `Bearer <JWT_TOKEN>`
* **Historical Protection**: Deleting a recurring schedule removes the template only; all past generated transactions are preserved intact.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Recurring transaction deleted successfully"
  }
  ```

#### 6. Pause / Resume Schedule
* **Pause Endpoint**: `POST /api/recurring-transactions/:id/pause`
  * Sets `active = false`. Paused schedules are skipped during occurrence processing.
* **Resume Endpoint**: `POST /api/recurring-transactions/:id/resume`
  * Sets `active = true` and advances `nextRunAt` to the next valid upcoming occurrence.

#### 7. Process Due Recurring Transactions (Catch-Up Processor)
* **Method**: `POST`
* **URL**: `/api/recurring-transactions/process`
* **Auth**: `Bearer <JWT_TOKEN>`
* **User Scoping**: Processes **ONLY** the authenticated user's due recurring schedules (`nextRunAt <= now`).
* **Idempotency & Duplicate Prevention**: Database uniqueness constraint `(recurringTransactionId, recurringOccurrenceAt)` guarantees zero duplicate transactions even during concurrent/multiple runs.
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Recurring transactions processed successfully",
    "data": {
      "processedSchedules": 2,
      "generatedTransactions": 3,
      "skippedDuplicates": 0,
      "deactivatedSchedules": 0
    }
  }
  ```

---

### Date Calculation & Occurrence Rules

* **Anchor Day Preservation (Month-End)**:
  * Schedules starting on day 31 (e.g., Jan 31) preserve day 31 as the anchor:
    * `Jan 31` $\rightarrow$ `Feb 28` (or `Feb 29`) $\rightarrow$ `Mar 31` $\rightarrow$ `Apr 30` $\rightarrow$ `May 31`.
* **Leap-Year Handling (Yearly)**:
  * Schedules starting on Feb 29 (e.g., Feb 29, 2028) generate on `Feb 28` in non-leap years (2029, 2030, 2031) and `Feb 29` in leap years.
* **End Date Clamping**:
  * Occurrences are generated only while `occurrenceDate <= endDate`. If the next occurrence exceeds `endDate`, the schedule is automatically marked `active = false`.
* **Seamless Ecosystem Integration**:
  * Generated transactions are standard `Transaction` records and automatically flow into Budgets, Dashboard, and Analytics.

---

## 8. Security Principles

1. **Password Hashing**: Passwords are never stored or logged in plain text. Hashed using `bcryptjs` with salt work factor 10.
2. **Safe Projections**: User queries explicitly select safe fields (`id`, `name`, `email`), ensuring `password` is never sent in API responses.
3. **Data Ownership**: Architectural foundation ensures all resources are scoped and isolated by `userId`.
4. **Input Validation**: All payloads validated with Zod before reaching services.
5. **No Credential Leaks**: Stack traces and database internals are logged on the server but hidden from client error responses.

---

## 9. Financial Goals Module API Reference

Base Path: `/api/goals`  
All endpoints require JWT Authentication: `Authorization: Bearer <TOKEN>`

### Database Models & Enums

* **`GoalStatus`**: `ACTIVE`, `PAUSED`, `COMPLETED`, `OVERDUE`
* **`ContributionType`**: `MANUAL`, `ADJUSTMENT`
* **`FinancialGoal`**: `id`, `name`, `description`, `targetAmount` (`Decimal(12,2)`), `currentAmount` (`Decimal(12,2)`), `deadline` (`DateTime?`), `status`, `userId`, `createdAt`, `updatedAt`
* **`GoalContribution`**: `id`, `amount` (`Decimal(12,2)`), `type`, `note`, `goalId`, `userId`, `createdAt`

### Endpoints Overview

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/goals` | Create a new financial savings goal |
| `GET` | `/api/goals` | List all goals with filtering & sorting |
| `GET` | `/api/goals/summary` | Get aggregated summary metrics |
| `GET` | `/api/goals/:id` | Get single goal by ID |
| `PATCH` | `/api/goals/:id` | Update goal mutable fields |
| `DELETE` | `/api/goals/:id` | Delete goal & cascade contributions |
| `POST` | `/api/goals/:id/pause` | Pause goal status |
| `POST` | `/api/goals/:id/resume` | Resume goal status to ACTIVE |
| `POST` | `/api/goals/:id/complete` | Mark goal status as COMPLETED |
| `POST` | `/api/goals/:id/contributions` | Add contribution (atomic increment) |
| `GET` | `/api/goals/:id/contributions` | List contribution history for goal |
| `DELETE` | `/api/goals/:goalId/contributions/:contributionId` | Delete contribution (atomic decrement) |

### Runtime Calculations (Non-Persisted)

- **`remainingAmount`**: `max(targetAmount - currentAmount, 0)`
- **`progressPercentage`**: `min((currentAmount / targetAmount) * 100, 100)`
- **`daysRemaining`**: UTC calendar-day difference between today and deadline (`null` if no deadline)
- **`derivedStatus`** precedence order:
  1. `PAUSED`
  2. `COMPLETED`
  3. `NOT_STARTED` (when `currentAmount === 0`)
  4. `OVERDUE` (when deadline passed & not completed)
  5. `AT_RISK` (when progress >10% behind linear target pace)
  6. `ON_TRACK` (otherwise)

### Contribution & Transaction Rules
- Contributions to `PAUSED` or `COMPLETED` goals are rejected (HTTP 400).
- Contributions use Prisma transactions and atomic `{ increment: amount }` / `{ decrement: amount }` operations.
- `currentAmount` never drops below 0.
- Goal deletion cascades to contributions, while preserving all unrelated `Transaction` records.

---

## 10. User Profile & Settings Module API Reference

Base Path: `/api/users`  
All endpoints require JWT Authentication: `Authorization: Bearer <TOKEN>`

### Database Models & Enums

* **`CurrencyCode`**: `INR`, `USD`, `EUR`, `GBP`, `AED`
* **`ThemePreference`**: `SYSTEM`, `LIGHT`, `DARK`
* **`UserSettings`**: `id`, `userId` (`@unique`), `currency` (`default: INR`), `monthlyBudgetEnabled` (`default: false`), `monthlyBudgetAmount` (`Decimal(12,2)?`), `budgetAlertsEnabled` (`default: true`), `recurringRemindersEnabled` (`default: true`), `goalRemindersEnabled` (`default: true`), `theme` (`default: SYSTEM`), `createdAt`, `updatedAt`

### Endpoints Overview

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/users/me` | Fetch authenticated user's safe profile (`id`, `name`, `email`, `createdAt`, `updatedAt`) |
| `PATCH` | `/api/users/me` | Update profile information (`name`) |
| `PATCH` | `/api/users/me/password` | Securely change password with current password verification |
| `GET` | `/api/users/settings` | Get user preferences (auto-creates defaults via upsert) |
| `PATCH` | `/api/users/settings` | Update preferences (`currency`, `monthlyBudgetEnabled`, `monthlyBudgetAmount`, alerts, `theme`) |
| `DELETE` | `/api/users/me` | Permanently delete user account & cascade all user data after password verification |

### Key Business & Security Rules
- **Safe Profile Projections**: Password hash is never returned in API responses.
- **Password Change**: Verification of `currentPassword` using bcrypt comparison is strictly required. New password must differ from current password and be $\ge$ 6 characters.
- **User Settings Auto-Upsert**: Accessing `/api/users/settings` automatically initializes default settings (`INR`, `SYSTEM`, alerts enabled) if not present.
- **Monthly Budget Preference**: `monthlyBudgetAmount` is a preference only and remains independent from the Budgets module.
- **Account Deletion Cascade**: Account deletion requires password confirmation. Deleting a user cascade-deletes all owned data (`UserSettings`, `Category`, `Transaction`, `Budget`, `RecurringTransaction`, `FinancialGoal`, `GoalContribution`).


