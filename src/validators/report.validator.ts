import { z } from "zod";

/**
 * Returns the last calendar day of a given month in UTC (1-indexed month 1..12).
 */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Strict calendar date validation for YYYY-MM-DD strings.
 * Validates regex structure AND exact calendar validity (e.g. rejects 2026-02-30, 2026-04-31).
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;

  const year = parseInt(parts[0]!, 10);
  const month = parseInt(parts[1]!, 10);
  const day = parseInt(parts[2]!, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (month < 1 || month > 12) return false;

  const maxDay = lastDayOfMonth(year, month);
  if (day < 1 || day > maxDay) return false;

  return true;
}

const strictDateStringValidator = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .refine((val) => isValidCalendarDate(val), {
      message: `Invalid ${label} format or non-existent calendar date (expected YYYY-MM-DD)`,
    });

/**
 * Base Date Range Object (before refinement)
 */
export const baseDateRangeObject = z.object({
  from: strictDateStringValidator("from"),
  to: strictDateStringValidator("to"),
});

function refineDateOrder<T extends { from: string; to: string }>(
  data: T,
  ctx: z.RefinementCtx
) {
  if (isValidCalendarDate(data.from) && isValidCalendarDate(data.to)) {
    if (data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date (to) must be greater than or equal to start date (from)",
        path: ["to"],
      });
    }
  }
}

/**
 * Base Date Range Schema enforcing `from <= to`
 */
export const reportDateRangeSchema = baseDateRangeObject.superRefine(refineDateOrder);

export const CashFlowGroupByEnum = z.enum(["day", "week", "month"], {
  errorMap: () => ({
    message: "groupBy must be one of: day, week, month",
  }),
});

export const CustomReportGroupByEnum = z.enum(["day", "week", "month", "category"], {
  errorMap: () => ({
    message: "groupBy must be one of: day, week, month, category",
  }),
});

export const cashFlowQuerySchema = baseDateRangeObject
  .extend({
    groupBy: CashFlowGroupByEnum.optional().default("month"),
  })
  .superRefine(refineDateOrder);

export const savingsQuerySchema = baseDateRangeObject
  .extend({
    groupBy: CashFlowGroupByEnum.optional().default("month"),
  })
  .superRefine(refineDateOrder);

export const customReportQuerySchema = baseDateRangeObject
  .extend({
    groupBy: CustomReportGroupByEnum.optional().default("month"),
  })
  .superRefine(refineDateOrder);

export type ReportDateRangeInput = z.infer<typeof reportDateRangeSchema>;
export type CashFlowQueryInput = z.infer<typeof cashFlowQuerySchema>;
export type SavingsQueryInput = z.infer<typeof savingsQuerySchema>;
export type CustomReportQueryInput = z.infer<typeof customReportQuerySchema>;
