import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  createGoalHandler,
  listGoalsHandler,
  getGoalHandler,
  updateGoalHandler,
  deleteGoalHandler,
  addContributionHandler,
  listContributionsHandler,
  deleteContributionHandler,
  pauseGoalHandler,
  resumeGoalHandler,
  completeGoalHandler,
  goalSummaryHandler,
} from "../controllers/goal.controller.js";

const router = Router();

// All goal routes require authentication
router.use(authenticate);

// Summary MUST be registered before /:id so it isn't treated as an id param
router.get("/summary", goalSummaryHandler);

// Goal CRUD
router.post("/", createGoalHandler);
router.get("/", listGoalsHandler);
router.get("/:id", getGoalHandler);
router.patch("/:id", updateGoalHandler);
router.delete("/:id", deleteGoalHandler);

// Lifecycle transitions
router.post("/:id/pause", pauseGoalHandler);
router.post("/:id/resume", resumeGoalHandler);
router.post("/:id/complete", completeGoalHandler);

// Contributions
router.post("/:id/contributions", addContributionHandler);
router.get("/:id/contributions", listContributionsHandler);
router.delete("/:goalId/contributions/:contributionId", deleteContributionHandler);

export const goalRouter = router;
