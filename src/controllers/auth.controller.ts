import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllSessions,
  getUserProfile,
} from "../services/auth.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
} from "../utils/cookie.js";

export const registerHandler = async (
  req: Request,
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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await loginUser(validatedData);

    // Set HttpOnly refresh token cookie
    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      getRefreshCookieOptions()
    );

    sendSuccess(res, 200, "Login successful", {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await refreshAccessToken(rawRefreshToken);

    // Update cookie if new token was issued (rotated)
    if (result.refreshToken) {
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.refreshToken,
        getRefreshCookieOptions()
      );
    }

    sendSuccess(res, 200, "Token refreshed successfully", {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    // Clear invalid/expired/reused cookie on error
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    next(error);
  }
};

export const logoutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await logoutUser(rawRefreshToken);

    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    sendSuccess(res, 200, "Logged out successfully");
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
    next(error);
  }
};

export const logoutAllHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    await logoutAllSessions(userId);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });

    sendSuccess(res, 200, "Logged out from all devices successfully");
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
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
