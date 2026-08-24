import { Router } from "express";
import {
  createCategoryHandler,
  getCategoriesHandler,
  getCategoryByIdHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from "../controllers/category.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

// All category routes require authentication
router.use(authenticate);

router.post("/", createCategoryHandler);
router.get("/", getCategoriesHandler);
router.get("/:id", getCategoryByIdHandler);
router.patch("/:id", updateCategoryHandler);
router.delete("/:id", deleteCategoryHandler);

export const categoryRouter = router;
