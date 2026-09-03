import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { AppError } from "../middlewares/error.middleware.js";
import {
  createGoalSchema,
  updateGoalSchema,
  contributionSchema,
  goalQuerySchema,
} from "../validators/goal.validator.js";
import {
  createGoal,
  listGoals,
  getGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  listContributions,
  deleteContribution,
  pauseGoal,
  resumeGoal,
  completeGoal,
  getGoalSummary,
} from "../services/goal.service.js";
import { sendSuccess } from "../utils/response.js";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const createGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const validatedData = createGoalSchema.parse(req.body);
    const goal = await createGoal(userId, validatedData);

    sendSuccess(res, 201, "Goal created successfully", goal);
  } catch (error) {
    next(error);
  }
};

export const listGoalsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const query = goalQuerySchema.parse(req.query);
    const goals = await listGoals(userId, query);

    sendSuccess(res, 200, "Goals fetched successfully", goals);
  } catch (error) {
    next(error);
  }
};

export const getGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const goal = await getGoal(userId, req.params.id as string);

    sendSuccess(res, 200, "Goal fetched successfully", goal);
  } catch (error) {
    next(error);
  }
};

export const updateGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const validatedData = updateGoalSchema.parse(req.body);
    const goal = await updateGoal(userId, req.params.id as string, validatedData);

    sendSuccess(res, 200, "Goal updated successfully", goal);
  } catch (error) {
    next(error);
  }
};

export const deleteGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    await deleteGoal(userId, req.params.id as string);

    sendSuccess(res, 200, "Goal deleted successfully");
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

export const addContributionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const validatedData = contributionSchema.parse(req.body);
    const result = await addContribution(userId, req.params.id as string, validatedData);

    sendSuccess(res, 201, "Contribution added successfully", result);
  } catch (error) {
    next(error);
  }
};

export const listContributionsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const contributions = await listContributions(userId, req.params.id as string);

    sendSuccess(res, 200, "Contributions fetched successfully", contributions);
  } catch (error) {
    next(error);
  }
};

export const deleteContributionHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const goal = await deleteContribution(
      userId,
      req.params.goalId as string,
      req.params.contributionId as string
    );

    sendSuccess(res, 200, "Contribution deleted successfully", goal);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const pauseGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const goal = await pauseGoal(userId, req.params.id as string);

    sendSuccess(res, 200, "Goal paused successfully", goal);
  } catch (error) {
    next(error);
  }
};

export const resumeGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const goal = await resumeGoal(userId, req.params.id as string);

    sendSuccess(res, 200, "Goal resumed successfully", goal);
  } catch (error) {
    next(error);
  }
};

export const completeGoalHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const goal = await completeGoal(userId, req.params.id as string);

    sendSuccess(res, 200, "Goal completed successfully", goal);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export const goalSummaryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError("Authentication required", 401);

    const summary = await getGoalSummary(userId);

    sendSuccess(res, 200, "Goal summary fetched successfully", summary);
  } catch (error) {
    next(error);
  }
};
