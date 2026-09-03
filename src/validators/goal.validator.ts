import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums (mirror Prisma GoalStatus / ContributionType enums)
// ---------------------------------------------------------------------------

export const GoalStatusEnum = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "OVERDUE"], {
  errorMap: () => ({ message: "Invalid goal status" }),
});

export const ContributionTypeEnum = z.enum(["MANUAL", "ADJUSTMENT"], {
  errorMap: () => ({ message: "Invalid contribution type" }),
});

// ---------------------------------------------------------------------------
// Shared positive‑decimal validator
// Accepts: number or string, must be > 0, max 2 decimal places
// Transforms to string for safe Prisma Decimal handling
// ---------------------------------------------------------------------------

const positiveDecimalValidator = z
  .union([z.number(), z.string()], {
    required_error: "Amount is required",
    invalid_type_error: "Amount must be a positive number",
  })
  .refine(
    (val) => {
      const num = typeof val === "number" ? val : Number(val);
      return !isNaN(num) && isFinite(num) && num > 0;
    },
    { message: "Amount must be greater than 0" }
  )
  .refine(
    (val) => {
      const str = typeof val === "number" ? val.toString() : val.trim();
      const parts = str.split(".");
      return parts.length <= 1 || (parts[1]?.length ?? 0) <= 2;
    },
    { message: "Maximum 2 decimal places allowed" }
  )
  .transform((val) => (typeof val === "number" ? val.toString() : val.trim()));

// ---------------------------------------------------------------------------
// Date / datetime string validator
// ---------------------------------------------------------------------------

const isoDateStringValidator = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: `Invalid ${label}`,
    });

// ---------------------------------------------------------------------------
// Create Goal schema
// ---------------------------------------------------------------------------

export const createGoalSchema = z.object({
  name: z
    .string({ required_error: "Goal name is required" })
    .trim()
    .min(1, { message: "Goal name must not be empty" })
    .max(100, { message: "Goal name must not exceed 100 characters" }),
  description: z
    .string()
    .trim()
    .max(500, { message: "Description must not exceed 500 characters" })
    .optional(),
  targetAmount: positiveDecimalValidator,
  deadline: isoDateStringValidator("deadline").optional(),
});

// ---------------------------------------------------------------------------
// Update Goal schema — all fields optional, at least one must be present
// Server‑managed fields (currentAmount, status, createdAt, updatedAt) are NOT
// included so any attempt to pass them is silently stripped by Zod strict‑mode
// or caught at the controller level.
// ---------------------------------------------------------------------------

export const updateGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable(),
    targetAmount: positiveDecimalValidator.optional(),
    deadline: isoDateStringValidator("deadline").optional().nullable(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" }
  );

// ---------------------------------------------------------------------------
// Contribution schema
// ---------------------------------------------------------------------------

export const contributionSchema = z.object({
  amount: positiveDecimalValidator,
  note: z
    .string()
    .trim()
    .max(250, { message: "Note must not exceed 250 characters" })
    .optional(),
  type: ContributionTypeEnum.optional(),
});

// ---------------------------------------------------------------------------
// Query / filter schema for listing goals
// ---------------------------------------------------------------------------

export const goalQuerySchema = z.object({
  status: GoalStatusEnum.optional(),
  search: z.string().trim().optional(),
  hasDeadline: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
  sortBy: z
    .enum(["createdAt", "deadline", "targetAmount", "currentAmount", "name"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ---------------------------------------------------------------------------
// Exported TypeScript types
// ---------------------------------------------------------------------------

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
export type GoalQueryInput = z.infer<typeof goalQuerySchema>;
