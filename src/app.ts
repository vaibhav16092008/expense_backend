import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware.js";
import { securityHeadersMiddleware } from "./middlewares/securityHeaders.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { getMetrics } from "./controllers/health.controller.js";
import { authRouter } from "./routes/auth.routes.js";
import { categoryRouter } from "./routes/category.routes.js";
import { transactionRouter } from "./routes/transaction.routes.js";
import { budgetRouter } from "./routes/budget.routes.js";
import { goalRouter } from "./routes/goal.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { recurringTransactionRouter } from "./routes/recurringTransaction.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { exportRouter } from "./routes/export.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";

const app: Express = express();

// 1. Request ID Correlation Middleware
app.use(requestIdMiddleware);

// 2. HTTP Request Logger Middleware
app.use(requestLoggerMiddleware);

// 3. Security Headers Middleware (Helmet + Custom Security Headers)
app.use(helmet());
app.use(securityHeadersMiddleware);

// 4. Production-safe CORS Configuration with Credentials support
const allowedOrigins =
  env.CORS_ORIGIN === "*"
    ? "*"
    : env.CORS_ORIGIN.split(",").map((o) => o.trim());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins === "*" || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// 5. Cookie Parser & Body Size Limits
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// 6. Health & Metrics Routes (accessible at root and /api prefixes)
app.use("/health", healthRouter);
app.use("/api/health", healthRouter);
app.get("/metrics", getMetrics);
app.get("/api/metrics", getMetrics);

// 7. Core Business API Routes
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/budgets", budgetRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/recurring-transactions", recurringTransactionRouter);
app.use("/api/goals", goalRouter);
app.use("/api/users", userRouter);
app.use("/api/reports", reportRouter);
app.use("/api/exports", exportRouter);
app.use("/api/notifications", notificationRouter);

// 8. 404 Handler
app.use(notFoundHandler);

// 9. Global Error Handler
app.use(errorHandler);

export default app;
