import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const BudgetTypeEnum = z.enum(["OVERALL", "CATEGORY"], {
  errorMap: () => ({ message: "Type must be either OVERALL or CATEGORY" }),
});

export const BudgetPeriodEnum = z.enum(["WEEKLY", "MONTHLY", "CUSTOM"], {
  errorMap: () => ({
    message: "Period must be WEEKLY, MONTHLY, or CUSTOM",
  }),
});

export const BudgetStatusEnum = z.enum(
  ["ON_TRACK", "WARNING", "CRITICAL", "EXCEEDED"],
  {
    errorMap: () => ({
      message: "Status must be ON_TRACK, WARNING, CRITICAL, or EXCEEDED",
    }),
  }
);

// ---------------------------------------------------------------------------
// Shared amount validator (reused from transaction pattern)
// ---------------------------------------------------------------------------

const positiveAmountValidator = z
  .union([z.number(), z.string()], {
    required_error: "Amount is required",
    invalid_type_error: "Budget amount must be greater than 0",
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
    { message: "Budget amount must be greater than 0" }
  )
  .transform((val) =>
    typeof val === "number" ? val.toString() : val.trim()
  );

// ---------------------------------------------------------------------------
// Date string validator (ISO date or datetime string)
// ---------------------------------------------------------------------------

const dateStringValidator = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: `Invalid ${label}`,
    });

// ---------------------------------------------------------------------------
// Helper: return the last day of a month (UTC)
// ---------------------------------------------------------------------------

function lastDayOfMonth(year: number, month: number): number {
  // month is 0-indexed (Date constructor convention)
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Cross-field refinement (shared between create and update)
// ---------------------------------------------------------------------------

interface BudgetFieldsForValidation {
  type?: string;
  period?: string;
  categoryId?: string | null;
  startDate?: string;
  endDate?: string;
}

export function validateBudgetCrossFields(
  data: BudgetFieldsForValidation,
  ctx: z.RefinementCtx
): void {
  const { type, period, categoryId, startDate, endDate } = data;

  // --- Category / type rules ---
  if (type === "CATEGORY" && !categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Category is required for category budget",
      path: ["categoryId"],
    });
  }

  if (type === "OVERALL" && categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Category is not allowed for overall budget",
      path: ["categoryId"],
    });
  }

  // --- Date rules ---
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be greater than or equal to start date",
        path: ["endDate"],
      });
      return; // no further date checks if ordering is wrong
    }

    if (period === "MONTHLY") {
      // start must be the 1st of a month
      if (start.getUTCDate() !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "For a monthly budget, start date must be the first day of the month (e.g. 2026-08-01)",
          path: ["startDate"],
        });
      }
      // end must be the last day of the same month as start
      const expectedLastDay = lastDayOfMonth(
        start.getUTCFullYear(),
        start.getUTCMonth()
      );
      const endIsLastDay =
        end.getUTCFullYear() === start.getUTCFullYear() &&
        end.getUTCMonth() === start.getUTCMonth() &&
        end.getUTCDate() === expectedLastDay;

      if (!endIsLastDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `For a monthly budget, end date must be the last day of the same month (e.g. 2026-08-${expectedLastDay})`,
          path: ["endDate"],
        });
      }
    }

    if (period === "WEEKLY") {
      // exactly 7 calendar days: endDate date - startDate date === 6 days
      const startUtcDays = Math.floor(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate()
        ) /
          (1000 * 60 * 60 * 24)
      );
      const endUtcDays = Math.floor(
        Date.UTC(
          end.getUTCFullYear(),
          end.getUTCMonth(),
          end.getUTCDate()
        ) /
          (1000 * 60 * 60 * 24)
      );
      const diffDays = endUtcDays - startUtcDays;
      if (diffDays !== 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "For a weekly budget, the date range must be exactly 7 days (start date + 6 days = end date)",
          path: ["endDate"],
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Create schema
// ---------------------------------------------------------------------------

export const createBudgetSchema = z
  .object({
    amount: positiveAmountValidator,
    type: BudgetTypeEnum,
    period: BudgetPeriodEnum,
    startDate: dateStringValidator("startDate"),
    endDate: dateStringValidator("endDate"),
    categoryId: z
      .string()
      .uuid("Invalid category ID")
      .optional()
      .nullable(),
  })
  .superRefine(validateBudgetCrossFields);

// ---------------------------------------------------------------------------
// Update schema — all fields optional; cross-field check done in service
// using the merged final state
// ---------------------------------------------------------------------------

export const updateBudgetSchema = z
  .object({
    amount: positiveAmountValidator.optional(),
    type: BudgetTypeEnum.optional(),
    period: BudgetPeriodEnum.optional(),
    startDate: dateStringValidator("startDate").optional(),
    endDate: dateStringValidator("endDate").optional(),
    categoryId: z
      .string()
      .uuid("Invalid category ID")
      .optional()
      .nullable(),
  })
  .refine(
    (data) =>
      Object.values(data).some((v) => v !== undefined),
    { message: "At least one field is required for update" }
  );

// ---------------------------------------------------------------------------
// Query / filter schema
// ---------------------------------------------------------------------------

export const budgetQuerySchema = z.object({
  type: BudgetTypeEnum.optional(),
  period: BudgetPeriodEnum.optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  startDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid startDate" })
    .optional(),
  endDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid endDate" })
    .optional(),
  status: BudgetStatusEnum.optional(),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type BudgetQueryInput = z.infer<typeof budgetQuerySchema>;
export type BudgetStatus = z.infer<typeof BudgetStatusEnum>;
