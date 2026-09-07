import { Router } from "express";
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  logoutAllHandler,
  getMeHandler,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rateLimit.middleware.js";
import { validateCookieCsrf } from "../utils/cookie.js";

const router = Router();

router.post("/register", authRateLimiter, registerHandler);
router.post("/login", authRateLimiter, loginHandler);
router.post("/refresh", authRateLimiter, validateCookieCsrf, refreshHandler);
router.post("/logout", validateCookieCsrf, logoutHandler);
router.post("/logout-all", authRateLimiter, authenticate, logoutAllHandler);
router.get("/me", authenticate, getMeHandler);

export const authRouter = router;
