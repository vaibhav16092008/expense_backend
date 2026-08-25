import { Router } from "express";
import {
  createRecurringTransactionHandler,
  getRecurringTransactionsHandler,
  getRecurringTransactionByIdHandler,
  updateRecurringTransactionHandler,
  deleteRecurringTransactionHandler,
  pauseRecurringTransactionHandler,
  resumeRecurringTransactionHandler,
  processDueRecurringTransactionsHandler,
} from "../controllers/recurringTransaction.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post("/", createRecurringTransactionHandler);
router.get("/", getRecurringTransactionsHandler);
router.post("/process", processDueRecurringTransactionsHandler);
router.get("/:id", getRecurringTransactionByIdHandler);
router.patch("/:id", updateRecurringTransactionHandler);
router.delete("/:id", deleteRecurringTransactionHandler);
router.post("/:id/pause", pauseRecurringTransactionHandler);
router.post("/:id/resume", resumeRecurringTransactionHandler);

export const recurringTransactionRouter = router;
