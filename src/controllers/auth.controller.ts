import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
import { registerUser, loginUser, getUserProfile } from "../services/auth.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const registerHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const user = await registerUser(validatedData);
    sendSuccess(res, 201, "User registered successfully", user);
  } catch (error) {
    next(error);
  }
};

export const loginHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await loginUser(validatedData);
    sendSuccess(res, 200, "Login successful", result);
  } catch (error) {
    next(error);
  }
};

export const getMeHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }
    const profile = await getUserProfile(userId);
    sendSuccess(res, 200, "User fetched successfully", profile);
  } catch (error) {
    next(error);
  }
};
