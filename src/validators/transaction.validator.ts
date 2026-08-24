import { z } from "zod";

export const TransactionTypeEnum = z.enum(["EXPENSE", "INCOME"], {
  errorMap: () => ({ message: "Type must be either EXPENSE or INCOME" }),
});

const positiveAmountValidator = z
  .union([z.number(), z.string()], {
    required_error: "Amount is required",
    invalid_type_error: "Amount must be greater than 0",
  })
  .refine(
    (val) => {
      if (typeof val === "number") {
        return !isNaN(val) && isFinite(val) && val > 0;
      }
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (!trimmed) return false;
        const num = Number(trimmed);
        return !isNaN(num) && isFinite(num) && num > 0;
      }
      return false;
    },
    { message: "Amount must be greater than 0" }
  )
  .transform((val) => (typeof val === "number" ? val.toString() : val.trim()));

export const createTransactionSchema = z.object({
  amount: positiveAmountValidator,
  type: TransactionTypeEnum,
  categoryId: z
    .string({ required_error: "Category ID is required" })
    .uuid("Invalid category ID"),
  note: z
    .string()
    .trim()
    .max(500, "Note must not exceed 500 characters")
    .optional()
    .nullable(),
  date: z
    .string({ required_error: "Transaction date is required" })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid transaction date",
    }),
});

export const updateTransactionSchema = z
  .object({
    amount: positiveAmountValidator.optional(),
    type: TransactionTypeEnum.optional(),
    categoryId: z.string().uuid("Invalid category ID").optional(),
    note: z
      .string()
      .trim()
      .max(500, "Note must not exceed 500 characters")
      .optional()
      .nullable(),
    date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid transaction date",
      })
      .optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).length > 0 &&
      Object.values(data).some((val) => val !== undefined),
    {
      message: "At least one field is required",
    }
  );

export const transactionQuerySchema = z.object({
  type: TransactionTypeEnum.optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  startDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid start date",
    })
    .optional(),
  endDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid end date",
    })
    .optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
