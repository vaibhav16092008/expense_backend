import { z } from "zod";

export const RecurringFrequencyEnum = z.enum(
  ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
  {
    errorMap: () => ({
      message: "Frequency must be DAILY, WEEKLY, MONTHLY, or YEARLY",
    }),
  }
);

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
  .transform((val) =>
    typeof val === "number" ? val.toString() : val.trim()
  );

export const createRecurringTransactionSchema = z
  .object({
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
    frequency: RecurringFrequencyEnum,
    startDate: z
      .string({ required_error: "Start date is required" })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start date format",
      }),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end date format",
      })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be greater than or equal to start date",
          path: ["endDate"],
        });
      }
    }
  });

export const updateRecurringTransactionSchema = z
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
    frequency: RecurringFrequencyEnum.optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start date format",
      })
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end date format",
      })
      .optional()
      .nullable(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field is required for update" }
  )
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date must be greater than or equal to start date",
          path: ["endDate"],
        });
      }
    }
  });

export const recurringTransactionQuerySchema = z.object({
  active: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        if (val.toLowerCase() === "true") return true;
        if (val.toLowerCase() === "false") return false;
      }
      return undefined;
    }),
  type: TransactionTypeEnum.optional(),
  frequency: RecurringFrequencyEnum.optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  startDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid start date format",
    })
    .optional(),
  endDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid end date format",
    })
    .optional(),
  sortBy: z.enum(["nextRunAt", "createdAt", "amount"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type CreateRecurringTransactionInput = z.infer<
  typeof createRecurringTransactionSchema
>;
export type UpdateRecurringTransactionInput = z.infer<
  typeof updateRecurringTransactionSchema
>;
export type RecurringTransactionQueryInput = z.infer<
  typeof recurringTransactionQuerySchema
>;
