import { Category, CategoryType } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import {
  QueryCategoryInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validators/category.validator.js";
import {
  PaginatedResult,
  getPaginationParams,
  buildPaginationMeta,
} from "../utils/pagination.js";
import { AppError } from "../middlewares/error.middleware.js";

export const createCategory = async (
  userId: string,
  input: CreateCategoryInput
): Promise<Category> => {
  const normalizedName = input.name.trim();

  const existingCategory = await prisma.category.findFirst({
    where: {
      userId,
      name: normalizedName,
      type: input.type as CategoryType,
    },
  });

  if (existingCategory) {
    throw new AppError("Category already exists", 409);
  }

  const category = await prisma.category.create({
    data: {
      name: normalizedName,
      type: input.type as CategoryType,
      userId,
    },
  });

  return category;
};

export const getCategories = async (
  userId: string,
  query: QueryCategoryInput
): Promise<PaginatedResult<Category>> => {
  const where = {
    userId,
    ...(query.type ? { type: query.type as CategoryType } : {}),
  };

  const { skip, take, page, limit } = getPaginationParams(
    query.page,
    query.limit
  );

  const [totalCount, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    data: categories,
    pagination: buildPaginationMeta(page, limit, totalCount),
  };
};

export const getCategoryById = async (
  userId: string,
  categoryId: string
): Promise<Category> => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId,
    },
  });

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  return category;
};

export const updateCategory = async (
  userId: string,
  categoryId: string,
  input: UpdateCategoryInput
): Promise<Category> => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId,
    },
  });

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  const nextName = input.name !== undefined ? input.name.trim() : category.name;
  const nextType = (input.type as CategoryType) ?? category.type;

  // Check if updating name or type would cause a duplicate
  if (nextName !== category.name || nextType !== category.type) {
    const duplicate = await prisma.category.findFirst({
      where: {
        userId,
        name: nextName,
        type: nextType,
        NOT: {
          id: categoryId,
        },
      },
    });

    if (duplicate) {
      throw new AppError("Category already exists", 409);
    }
  }

  const updatedCategory = await prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      name: nextName,
      type: nextType,
    },
  });

  return updatedCategory;
};

export const deleteCategory = async (
  userId: string,
  categoryId: string
): Promise<Category> => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId,
    },
  });

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  // Prevent deleting category if it is referenced by existing transactions
  const transactionsCount = await prisma.transaction.count({
    where: {
      categoryId,
    },
  });

  if (transactionsCount > 0) {
    throw new AppError(
      "Category cannot be deleted because it is used by transactions",
      409
    );
  }

  // Prevent deleting category if it is referenced by existing budgets
  const budgetsCount = await prisma.budget.count({
    where: { categoryId },
  });

  if (budgetsCount > 0) {
    throw new AppError(
      "Category cannot be deleted because it is used by budgets",
      409
    );
  }

  await prisma.category.delete({
    where: {
      id: categoryId,
    },
  });

  return category;
};
