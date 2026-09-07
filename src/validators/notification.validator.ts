import { z } from "zod";

export const NotificationTypeEnum = z.enum(
  [
    "BUDGET_WARNING",
    "BUDGET_CRITICAL",
    "BUDGET_EXCEEDED",
    "RECURRING_UPCOMING",
    "RECURRING_DUE",
    "GOAL_DEADLINE",
    "GOAL_PROGRESS",
    "MONTHLY_SUMMARY",
  ],
  {
    errorMap: () => ({
      message:
        "Type must be one of: BUDGET_WARNING, BUDGET_CRITICAL, BUDGET_EXCEEDED, RECURRING_UPCOMING, RECURRING_DUE, GOAL_DEADLINE, GOAL_PROGRESS, MONTHLY_SUMMARY",
    }),
  }
);

export const getNotificationsQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined) return 1;
      const num = typeof val === "string" ? parseInt(val, 10) : val;
      return isNaN(num) || num < 1 ? 1 : num;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        const num = typeof val === "string" ? parseInt(val, 10) : val;
        return !isNaN(num) && num >= 1 && num <= 100;
      },
      { message: "Limit must be a positive integer between 1 and 100" }
    )
    .transform((val) => {
      if (val === undefined) return 20;
      return typeof val === "string" ? parseInt(val, 10) : val;
    }),
  unreadOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (val === undefined) return false;
      if (typeof val === "boolean") return val;
      return val.toLowerCase() === "true";
    }),
  type: NotificationTypeEnum.optional(),
});

export const notificationIdParamSchema = z.object({
  id: z
    .string({ required_error: "Notification ID is required" })
    .uuid("Invalid notification ID"),
});

export type GetNotificationsQueryInput = z.infer<typeof getNotificationsQuerySchema>;
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>;
