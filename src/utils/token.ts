import jwt, { SignOptions, Secret } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";

export interface TokenPayload {
  userId: string;
  sessionId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as unknown as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, options);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as TokenPayload;
};

/**
 * Generates an opaque random 256-bit refresh token string.
 */
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Computes SHA-256 hash of a raw refresh token.
 */
export const hashRefreshToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
