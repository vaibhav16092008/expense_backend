import { z } from "zod";

export const DashboardPeriodEnum = z.enum(["today", "week", "month", "year"], {
  errorMap: () => ({
    message: "Period must be one of: today, week, month, year",
  }),
});

export const GranularityEnum = z.enum(["daily", "weekly", "monthly"], {
  errorMap: () => ({
    message: "Granularity must be one of: daily, weekly, monthly",
  }),
});

export const dashboardQuerySchema = z
  .object({
    period: DashboardPeriodEnum.optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid startDate format",
      })
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid endDate format",
      })
      .optional(),
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

export const monthlyQuerySchema = z.object({
  year: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1970 && num <= 2100;
      },
      { message: "Year must be a valid 4-digit number between 1970 and 2100" }
    )
    .transform((val) => {
      if (val === undefined) return new Date().getUTCFullYear();
      return typeof val === "string" ? parseInt(val, 10) : val;
    }),
});

export const trendsQuerySchema = z
  .object({
    period: DashboardPeriodEnum.optional(),
    granularity: GranularityEnum.optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid startDate format",
      })
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid endDate format",
      })
      .optional(),
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

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;
export type MonthlyQueryInput = z.infer<typeof monthlyQuerySchema>;
export type TrendsQueryInput = z.infer<typeof trendsQuerySchema>;
export type DashboardPeriod = z.infer<typeof DashboardPeriodEnum>;
export type Granularity = z.infer<typeof GranularityEnum>;
