import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { RegisterInput, LoginInput } from "../validators/auth.validator.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../utils/token.js";
import { AppError } from "../middlewares/error.middleware.js";

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginResult {
  user: {
    id: string;
    name: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

export const registerUser = async (input: RegisterInput): Promise<SafeUser> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const newUser = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return newUser;
};

export const loginUser = async (input: LoginInput): Promise<LoginResult> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  // Generate 256-bit opaque refresh token
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Create persisted DB session
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      currentTokenHash: tokenHash,
      expiresAt,
    },
  });

  // Generate short-lived stateless 15m access token
  const accessToken = generateAccessToken({
    userId: user.id,
    sessionId: session.id,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
};

/**
 * Rotates refresh token or returns access token during 10s concurrent grace period.
 * Triggers reuse detection (revokes all user sessions) if old token is presented after 10s.
 */
export const refreshAccessToken = async (
  rawRefreshToken: string | undefined
): Promise<RefreshResult> => {
  if (!rawRefreshToken) {
    throw new AppError("Refresh token is required", 401);
  }

  const hash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.userSession.findFirst({
    where: {
      OR: [{ currentTokenHash: hash }, { previousTokenHash: hash }],
    },
  });

  if (!session) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (session.revokedAt !== null || session.expiresAt <= new Date()) {
    throw new AppError("Session revoked or expired", 401);
  }

  // Case A — Presenting current active token: perform normal rotation
  if (session.currentTokenHash === hash) {
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        previousTokenHash: session.currentTokenHash,
        currentTokenHash: newTokenHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt: newExpiresAt,
      },
    });

    const accessToken = generateAccessToken({
      userId: session.userId,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 900,
    };
  }

  // Case B & C — Presenting previous token
  const rotatedAtMs = session.rotatedAt ? session.rotatedAt.getTime() : 0;
  const timeSinceRotationMs = Date.now() - rotatedAtMs;

  // Case B: Concurrent request within 10-second grace period
  if (timeSinceRotationMs <= 10000) {
    const accessToken = generateAccessToken({
      userId: session.userId,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: null, // Do not issue new cookie on grace period reflection
      expiresIn: 900,
    };
  }

  // Case C: Reuse detection (attempting to use rotated token after > 10 seconds)
  await prisma.userSession.updateMany({
    where: {
      userId: session.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  throw new AppError(
    "Security alert: Refresh token reuse detected. All sessions revoked.",
    401
  );
};

/**
 * Revokes current session by refresh token.
 */
export const logoutUser = async (
  rawRefreshToken: string | undefined
): Promise<void> => {
  if (!rawRefreshToken) return;

  const hash = hashRefreshToken(rawRefreshToken);

  await prisma.userSession.updateMany({
    where: {
      OR: [{ currentTokenHash: hash }, { previousTokenHash: hash }],
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

/**
 * Revokes all active sessions for given user ID (Logout All Devices).
 */
export const logoutAllSessions = async (userId: string): Promise<void> => {
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const getUserProfile = async (
  userId: string
): Promise<{ id: string; name: string; email: string }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};
