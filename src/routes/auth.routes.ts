import { Router } from "express";
import {
  registerHandler,
  loginHandler,
  getMeHandler,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.post("/register", authRateLimiter, registerHandler);
router.post("/login", authRateLimiter, loginHandler);
router.get("/me", authenticate, getMeHandler);

export const authRouter = router;
