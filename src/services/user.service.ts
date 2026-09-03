import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import {
  UpdateProfileInput,
  ChangePasswordInput,
  UpdateUserSettingsInput,
  DeleteAccountInput,
} from "../validators/user.validator.js";

// ---------------------------------------------------------------------------
// Response Interfaces
// ---------------------------------------------------------------------------

export interface SafeUserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormattedUserSettings {
  id: string;
  userId: string;
  currency: string;
  monthlyBudgetEnabled: boolean;
  monthlyBudgetAmount: string | null;
  budgetAlertsEnabled: boolean;
  recurringRemindersEnabled: boolean;
  goalRemindersEnabled: boolean;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helper to format settings
// ---------------------------------------------------------------------------

function formatSettings(settings: {
  id: string;
  userId: string;
  currency: string;
  monthlyBudgetEnabled: boolean;
  monthlyBudgetAmount: Prisma.Decimal | null;
  budgetAlertsEnabled: boolean;
  recurringRemindersEnabled: boolean;
  goalRemindersEnabled: boolean;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
}): FormattedUserSettings {
  return {
    id: settings.id,
    userId: settings.userId,
    currency: settings.currency,
    monthlyBudgetEnabled: settings.monthlyBudgetEnabled,
    monthlyBudgetAmount: settings.monthlyBudgetAmount
      ? settings.monthlyBudgetAmount.toFixed(2)
      : null,
    budgetAlertsEnabled: settings.budgetAlertsEnabled,
    recurringRemindersEnabled: settings.recurringRemindersEnabled,
    goalRemindersEnabled: settings.goalRemindersEnabled,
    theme: settings.theme,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export const getMyProfile = async (
  userId: string
): Promise<SafeUserProfile> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

export const updateMyProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<SafeUserProfile> => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new AppError("User not found", 404);
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isPasswordValid = await bcrypt.compare(
    input.currentPassword,
    user.password
  );

  if (!isPasswordValid) {
    throw new AppError("Incorrect current password", 400);
  }

  const isSamePassword = await bcrypt.compare(
    input.newPassword,
    user.password
  );

  if (isSamePassword) {
    throw new AppError(
      "New password must be different from current password",
      400
    );
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
    },
  });
};

export const getUserSettings = async (
  userId: string
): Promise<FormattedUserSettings> => {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      currency: "INR",
      monthlyBudgetEnabled: false,
      monthlyBudgetAmount: null,
      budgetAlertsEnabled: true,
      recurringRemindersEnabled: true,
      goalRemindersEnabled: true,
      theme: "SYSTEM",
    },
    update: {},
  });

  return formatSettings(settings);
};

export const updateUserSettings = async (
  userId: string,
  input: UpdateUserSettingsInput
): Promise<FormattedUserSettings> => {
  // First ensure settings exist or get current settings
  const currentSettings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  const nextMonthlyBudgetEnabled =
    input.monthlyBudgetEnabled !== undefined
      ? input.monthlyBudgetEnabled
      : (currentSettings?.monthlyBudgetEnabled ?? false);

  let nextMonthlyBudgetAmount: Prisma.Decimal | null | undefined = undefined;

  if (nextMonthlyBudgetEnabled === false) {
    nextMonthlyBudgetAmount = null;
  } else if (input.monthlyBudgetAmount !== undefined) {
    nextMonthlyBudgetAmount = input.monthlyBudgetAmount
      ? new Prisma.Decimal(input.monthlyBudgetAmount)
      : null;
  }

  const updateData: Prisma.UserSettingsUpdateInput = {
    ...(input.currency && { currency: input.currency }),
    ...(input.monthlyBudgetEnabled !== undefined && {
      monthlyBudgetEnabled: input.monthlyBudgetEnabled,
    }),
    ...(nextMonthlyBudgetAmount !== undefined && {
      monthlyBudgetAmount: nextMonthlyBudgetAmount,
    }),
    ...(input.budgetAlertsEnabled !== undefined && {
      budgetAlertsEnabled: input.budgetAlertsEnabled,
    }),
    ...(input.recurringRemindersEnabled !== undefined && {
      recurringRemindersEnabled: input.recurringRemindersEnabled,
    }),
    ...(input.goalRemindersEnabled !== undefined && {
      goalRemindersEnabled: input.goalRemindersEnabled,
    }),
    ...(input.theme && { theme: input.theme }),
  };

  const createData: Prisma.UserSettingsCreateInput = {
    user: { connect: { id: userId } },
    currency: input.currency ?? "INR",
    monthlyBudgetEnabled: nextMonthlyBudgetEnabled,
    monthlyBudgetAmount:
      nextMonthlyBudgetAmount !== undefined
        ? nextMonthlyBudgetAmount
        : input.monthlyBudgetAmount
        ? new Prisma.Decimal(input.monthlyBudgetAmount)
        : null,
    budgetAlertsEnabled: input.budgetAlertsEnabled ?? true,
    recurringRemindersEnabled: input.recurringRemindersEnabled ?? true,
    goalRemindersEnabled: input.goalRemindersEnabled ?? true,
    theme: input.theme ?? "SYSTEM",
  };

  const updatedSettings = await prisma.userSettings.upsert({
    where: { userId },
    create: createData,
    update: updateData,
  });

  return formatSettings(updatedSettings);
};

export const deleteMyAccount = async (
  userId: string,
  input: DeleteAccountInput
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Incorrect password", 400);
  }

  // Deleting user triggers schema onDelete: Cascade for all user-owned data
  await prisma.user.delete({
    where: { id: userId },
  });
};
