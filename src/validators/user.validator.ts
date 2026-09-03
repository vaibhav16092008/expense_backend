import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums (mirroring Prisma CurrencyCode & ThemePreference)
// ---------------------------------------------------------------------------

export const CurrencyCodeEnum = z.enum(
  ["INR", "USD", "EUR", "GBP", "AED"],
  {
    errorMap: () => ({ message: "Currency must be INR, USD, EUR, GBP, or AED" }),
  }
);

export const ThemePreferenceEnum = z.enum(
  ["SYSTEM", "LIGHT", "DARK"],
  {
    errorMap: () => ({ message: "Theme must be SYSTEM, LIGHT, or DARK" }),
  }
);

// ---------------------------------------------------------------------------
// Shared positive decimal validator for monthly budget amount
// ---------------------------------------------------------------------------

const positiveAmountValidator = z
  .union([z.number(), z.string()], {
    invalid_type_error: "Monthly budget amount must be a positive number",
  })
  .refine(
    (val) => {
      const num = typeof val === "number" ? val : Number(val);
      return !isNaN(num) && isFinite(num) && num > 0;
    },
    { message: "Monthly budget amount must be greater than 0" }
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
// Update Profile Schema
// ---------------------------------------------------------------------------

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Name must be at least 1 character" })
      .max(100, { message: "Name must not exceed 100 characters" })
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided for profile update",
  });

// ---------------------------------------------------------------------------
// Change Password Schema
// ---------------------------------------------------------------------------

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Current password is required" })
      .min(1, { message: "Current password is required" }),
    newPassword: z
      .string({ required_error: "New password is required" })
      .min(6, { message: "New password must be at least 6 characters" }),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// ---------------------------------------------------------------------------
// Update User Settings Schema
// ---------------------------------------------------------------------------

export const updateUserSettingsSchema = z
  .object({
    currency: CurrencyCodeEnum.optional(),
    monthlyBudgetEnabled: z.boolean().optional(),
    monthlyBudgetAmount: positiveAmountValidator.optional().nullable(),
    budgetAlertsEnabled: z.boolean().optional(),
    recurringRemindersEnabled: z.boolean().optional(),
    goalRemindersEnabled: z.boolean().optional(),
    theme: ThemePreferenceEnum.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one setting field must be provided for update",
  })
  .superRefine((data, ctx) => {
    if (data.monthlyBudgetEnabled === true && data.monthlyBudgetAmount === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Monthly budget amount is required when monthly budget is enabled",
        path: ["monthlyBudgetAmount"],
      });
    }
  });

// ---------------------------------------------------------------------------
// Delete Account Schema
// ---------------------------------------------------------------------------

export const deleteAccountSchema = z.object({
  password: z
    .string({ required_error: "Password is required for account deletion" })
    .min(1, { message: "Password is required for account deletion" }),
});

// ---------------------------------------------------------------------------
// Exported TypeScript Types
// ---------------------------------------------------------------------------

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
