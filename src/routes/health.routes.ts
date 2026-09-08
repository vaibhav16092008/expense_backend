import { Router } from "express";
import {
  getHealth,
  getLiveness,
  getReadiness,
  getMetrics,
} from "../controllers/health.controller.js";

const router = Router();

router.get("/", getHealth);
router.get("/live", getLiveness);
router.get("/ready", getReadiness);
router.get("/db", getReadiness);
router.get("/metrics", getMetrics);

export const healthRouter = router;
