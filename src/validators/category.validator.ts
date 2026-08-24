import { z } from "zod";

export const CategoryTypeEnum = z.enum(["EXPENSE", "INCOME"], {
  errorMap: () => ({ message: "Type must be either EXPENSE or INCOME" }),
});

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(50, "Category name must not exceed 50 characters"),
  type: CategoryTypeEnum,
});

export const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters")
      .max(50, "Category name must not exceed 50 characters")
      .optional(),
    type: CategoryTypeEnum.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.type !== undefined,
    {
      message: "At least one of name or type must be provided for update",
    }
  );

export const queryCategorySchema = z.object({
  type: CategoryTypeEnum.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type QueryCategoryInput = z.infer<typeof queryCategorySchema>;
