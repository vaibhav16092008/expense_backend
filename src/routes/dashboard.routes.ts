import { Router } from "express";
import {
  getDashboardSummaryHandler,
  getMonthlyAnalyticsHandler,
  getCategoryAnalyticsHandler,
  getSpendingTrendsHandler,
  getBudgetOverviewHandler,
} from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All dashboard endpoints require authentication
router.use(authenticate);

router.get("/summary", getDashboardSummaryHandler);
router.get("/monthly", getMonthlyAnalyticsHandler);
router.get("/categories", getCategoryAnalyticsHandler);
router.get("/trends", getSpendingTrendsHandler);
router.get("/budget-overview", getBudgetOverviewHandler);

export const dashboardRouter = router;
