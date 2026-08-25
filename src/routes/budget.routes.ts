import { Router } from "express";
import {
  createBudgetHandler,
  getBudgetsHandler,
  getBudgetByIdHandler,
  updateBudgetHandler,
  deleteBudgetHandler,
} from "../controllers/budget.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All budget routes require authentication
router.use(authenticate);

router.post("/", createBudgetHandler);
router.get("/", getBudgetsHandler);
router.get("/:id", getBudgetByIdHandler);
router.patch("/:id", updateBudgetHandler);
router.delete("/:id", deleteBudgetHandler);

export const budgetRouter = router;
