import { Router } from "express";
import {
  getFinancialSummaryReportHandler,
  getCashFlowReportHandler,
  getCategoryReportHandler,
  getBudgetReportHandler,
  getSavingsReportHandler,
  getCustomReportHandler,
} from "../controllers/report.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All report endpoints require authentication
router.use(authenticate);

router.get("/summary", getFinancialSummaryReportHandler);
router.get("/cash-flow", getCashFlowReportHandler);
router.get("/categories", getCategoryReportHandler);
router.get("/budgets", getBudgetReportHandler);
router.get("/savings", getSavingsReportHandler);
router.get("/custom", getCustomReportHandler);

export const reportRouter = router;
