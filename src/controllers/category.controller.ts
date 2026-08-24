import { Response, NextFunction } from "express";
import { CategoryType } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
  createCategorySchema,
  updateCategorySchema,
  queryCategorySchema,
} from "../validators/category.validator.js";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../services/category.service.js";
import { sendSuccess } from "../utils/response.js";
import { AppError } from "../middlewares/error.middleware.js";

export const createCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const validatedData = createCategorySchema.parse(req.body);
    const category = await createCategory(userId, validatedData);

    sendSuccess(res, 201, "Category created successfully", category);
  } catch (error) {
    next(error);
  }
};

export const getCategoriesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const query = queryCategorySchema.parse(req.query);
    const categories = await getCategories(
      userId,
      query.type as CategoryType | undefined
    );

    sendSuccess(res, 200, "Categories fetched successfully", categories);
  } catch (error) {
    next(error);
  }
};

export const getCategoryByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const id = req.params.id as string;
    const category = await getCategoryById(userId, id);

    sendSuccess(res, 200, "Category fetched successfully", category);
  } catch (error) {
    next(error);
  }
};

export const updateCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const id = req.params.id as string;
    const validatedData = updateCategorySchema.parse(req.body);
    const category = await updateCategory(userId, id, validatedData);

    sendSuccess(res, 200, "Category updated successfully", category);
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const id = req.params.id as string;
    await deleteCategory(userId, id);

    sendSuccess(res, 200, "Category deleted successfully");
  } catch (error) {
    next(error);
  }
};
