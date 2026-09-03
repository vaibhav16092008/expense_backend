import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { sensitiveUserOpsRateLimiter } from "../middlewares/rateLimit.middleware.js";
import {
  getMyProfileHandler,
  updateMyProfileHandler,
  changePasswordHandler,
  getUserSettingsHandler,
  updateUserSettingsHandler,
  deleteMyAccountHandler,
} from "../controllers/user.controller.js";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Profile routes
router.get("/me", getMyProfileHandler);
router.patch("/me", updateMyProfileHandler);
router.patch("/me/password", sensitiveUserOpsRateLimiter, changePasswordHandler);

// Settings routes
router.get("/settings", getUserSettingsHandler);
router.patch("/settings", updateUserSettingsHandler);

// Account deletion route
router.delete("/me", sensitiveUserOpsRateLimiter, deleteMyAccountHandler);

export const userRouter = router;
