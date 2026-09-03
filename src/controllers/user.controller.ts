import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { AppError } from "../middlewares/error.middleware.js";
import {
  updateProfileSchema,
  changePasswordSchema,
  updateUserSettingsSchema,
  deleteAccountSchema,
} from "../validators/user.validator.js";
import {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getUserSettings,
  updateUserSettings,
  deleteMyAccount,
} from "../services/user.service.js";
import { sendSuccess } from "../utils/response.js";

// ---------------------------------------------------------------------------
// Profile Handlers
// ---------------------------------------------------------------------------

export const getMyProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const profile = await getMyProfile(userId);
    sendSuccess(res, 200, "Profile retrieved successfully", profile);
  } catch (error) {
    next(error);
  }
};

export const updateMyProfileHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const validatedData = updateProfileSchema.parse(req.body);
    const updatedProfile = await updateMyProfile(userId, validatedData);

    sendSuccess(res, 200, "Profile updated successfully", updatedProfile);
  } catch (error) {
    next(error);
  }
};

export const changePasswordHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const validatedData = changePasswordSchema.parse(req.body);
    await changePassword(userId, validatedData);

    sendSuccess(res, 200, "Password changed successfully");
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Settings Handlers
// ---------------------------------------------------------------------------

export const getUserSettingsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const settings = await getUserSettings(userId);
    sendSuccess(res, 200, "User settings retrieved successfully", settings);
  } catch (error) {
    next(error);
  }
};

export const updateUserSettingsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const validatedData = updateUserSettingsSchema.parse(req.body);
    const updatedSettings = await updateUserSettings(userId, validatedData);

    sendSuccess(res, 200, "User settings updated successfully", updatedSettings);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Account Deletion Handler
// ---------------------------------------------------------------------------

export const deleteMyAccountHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const validatedData = deleteAccountSchema.parse(req.body);
    await deleteMyAccount(userId, validatedData);

    sendSuccess(res, 200, "Account deleted successfully");
  } catch (error) {
    next(error);
  }
};
