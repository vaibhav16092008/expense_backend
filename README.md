# ExpenseIQ Server

ExpenseIQ Backend API — A production-quality, modular, and lightweight personal finance management REST API built with Node.js, Express, TypeScript, Prisma 6.x, PostgreSQL, Zod validation, and JWT authentication.

---

## 1. Project Overview

ExpenseIQ is an intelligent expense management platform engineered for seamless multi-client support (Web & Mobile). The backend provides a secure, ownership-driven architecture for tracking personal cash flows, category-wise budgets, analytics, and future AI-driven spending recommendations.

### Current Features (Initial Setup)
* **API Health & DB Monitoring**: Endpoints to check server lifecycle and PostgreSQL database connectivity.
* **User Registration**: Secure registration with Zod validation, duplicate email prevention, and bcrypt password hashing (10 salt rounds).
* **User Authentication & Login**: Safe credential verification returning JWT access tokens with structured user payloads.
* **Protected Routes & Current User Profile**: JWT authentication middleware extracting token claims and serving `/api/auth/me`.
* **Zero Password Leakage**: Passwords and sensitive internal details are stripped at the database/service layer.
* **Strict Error Handling**: Global middleware formatting errors without leaking database internals, SQL, or stack traces.

### Planned Features (Future Modules)
* User-created custom Categories (`EXPENSE` & `INCOME`)
* Transactions recording and history filtering
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

## 8. Security Principles

1. **Password Hashing**: Passwords are never stored or logged in plain text. Hashed using `bcryptjs` with salt work factor 10.
2. **Safe Projections**: User queries explicitly select safe fields (`id`, `name`, `email`), ensuring `password` is never sent in API responses.
3. **Data Ownership**: Architectural foundation ensures all resources are scoped and isolated by `userId`.
4. **Input Validation**: All payloads validated with Zod before reaching services.
5. **No Credential Leaks**: Stack traces and database internals are logged on the server but hidden from client error responses.
