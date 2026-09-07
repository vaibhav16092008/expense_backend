import { Router } from "express";
import {
  exportTransactionsHandler,
  exportReportHandler,
  exportFinancialJsonHandler,
} from "../controllers/export.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All export endpoints require authentication
router.use(authenticate);

router.get("/transactions", exportTransactionsHandler);
router.get("/reports", exportReportHandler);
router.get("/financial", exportFinancialJsonHandler);

export const exportRouter = router;
