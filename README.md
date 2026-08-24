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
* **Zero Password Leakage**: Passwords and sensitive internal details are stripped at the database/service layer.
* **Strict Error Handling**: Global middleware formatting errors without leaking database internals, SQL, or stack traces.

### Planned Features (Future Modules)
* Monthly and Category-wise Budgets
* Dashboard statistics and financial metrics
* Real-time spending warnings and notifications
* AI-powered spending insights and anomaly detection

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

## 8. Security Principles

1. **Password Hashing**: Passwords are never stored or logged in plain text. Hashed using `bcryptjs` with salt work factor 10.
2. **Safe Projections**: User queries explicitly select safe fields (`id`, `name`, `email`), ensuring `password` is never sent in API responses.
3. **Data Ownership**: Architectural foundation ensures all resources are scoped and isolated by `userId`.
4. **Input Validation**: All payloads validated with Zod before reaching services.
5. **No Credential Leaks**: Stack traces and database internals are logged on the server but hidden from client error responses.
