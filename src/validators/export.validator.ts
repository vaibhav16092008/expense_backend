import { z } from "zod";
import { isValidCalendarDate } from "./report.validator.js";

const strictOptionalDateValidator = (label: string) =>
  z
    .string()
    .refine((val) => isValidCalendarDate(val), {
      message: `Invalid ${label} format or non-existent calendar date (expected YYYY-MM-DD)`,
    })
    .optional();

const strictRequiredDateValidator = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .refine((val) => isValidCalendarDate(val), {
      message: `Invalid ${label} format or non-existent calendar date (expected YYYY-MM-DD)`,
    });

export const TransactionTypeEnum = z.enum(["INCOME", "EXPENSE"], {
  errorMap: () => ({ message: "Type must be either INCOME or EXPENSE" }),
});

export const ReportTypeEnum = z.enum(
  ["summary", "cash-flow", "categories", "budgets", "savings"],
  {
    errorMap: () => ({
      message: "Report type must be one of: summary, cash-flow, categories, budgets, savings",
    }),
  }
);

export const GroupByEnum = z.enum(["day", "week", "month"], {
  errorMap: () => ({
    message: "groupBy must be one of: day, week, month",
  }),
});

/**
 * Validator for GET /api/exports/transactions query parameters
 */
export const exportTransactionsQuerySchema = z
  .object({
    from: strictOptionalDateValidator("from"),
    to: strictOptionalDateValidator("to"),
    type: TransactionTypeEnum.optional(),
    categoryId: z.string().uuid("Invalid category ID").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && isValidCalendarDate(data.from) && isValidCalendarDate(data.to)) {
      if (data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date (to) must be greater than or equal to start date (from)",
          path: ["to"],
        });
      }
    }
  });

/**
 * Validator for GET /api/exports/reports query parameters
 */
export const exportReportQuerySchema = z
  .object({
    type: ReportTypeEnum,
    from: strictRequiredDateValidator("from"),
    to: strictRequiredDateValidator("to"),
    groupBy: GroupByEnum.optional(),
  })
  .superRefine((data, ctx) => {
    if (isValidCalendarDate(data.from) && isValidCalendarDate(data.to)) {
      if (data.from > data.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End date (to) must be greater than or equal to start date (from)",
          path: ["to"],
        });
      }
    }

    if (data.groupBy !== undefined) {
      if (data.type !== "cash-flow" && data.type !== "savings") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `groupBy parameter is not supported for ${data.type} report`,
          path: ["groupBy"],
        });
      }
    }
  });

export type ExportTransactionsQueryInput = z.infer<typeof exportTransactionsQuerySchema>;
export type ExportReportQueryInput = z.infer<typeof exportReportQuerySchema>;
