import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET || "default_jwt_secret_change_in_production",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

/**
 * Validates critical environment settings.
 * In production mode, unsafe fallback secrets or missing DB connections trigger an immediate error.
 */
export function validateEnv(
  environment: string = env.NODE_ENV,
  jwtSecret: string = env.JWT_ACCESS_SECRET,
  dbUrl: string = env.DATABASE_URL
): void {
  if (environment === "production") {
    if (!dbUrl.trim()) {
      throw new Error(
        "FATAL CONFIG ERROR: DATABASE_URL environment variable is required in production mode."
      );
    }
    if (
      !jwtSecret ||
      jwtSecret === "default_jwt_secret_change_in_production"
    ) {
      throw new Error(
        "FATAL SECURITY ERROR: JWT_ACCESS_SECRET must be explicitly configured with a secure key in production mode."
      );
    }
  }
}

// Run initial validation
validateEnv();
