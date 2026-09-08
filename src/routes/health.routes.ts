import { Router } from "express";
import {
  getHealth,
  getLiveness,
  getReadiness,
  getMetrics,
  getApiDocsInfo,
} from "../controllers/health.controller.js";

const router = Router();

router.get("/", getHealth);
router.get("/live", getLiveness);
router.get("/ready", getReadiness);
router.get("/db", getReadiness);
router.get("/metrics", getMetrics);
router.get("/docs", getApiDocsInfo);

export const healthRouter = router;
