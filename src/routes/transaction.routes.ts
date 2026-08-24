import { Router } from "express";
import {
  createTransactionHandler,
  getTransactionsHandler,
  getTransactionByIdHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
} from "../controllers/transaction.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

router.post("/", createTransactionHandler);
router.get("/", getTransactionsHandler);
router.get("/:id", getTransactionByIdHandler);
router.patch("/:id", updateTransactionHandler);
router.delete("/:id", deleteTransactionHandler);

export const transactionRouter = router;
