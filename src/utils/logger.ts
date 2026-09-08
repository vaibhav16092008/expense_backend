import { env } from "../config/env.js";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogPayload {
  level: LogLevel;
  event: string;
  message: string;
  requestId?: string;
  meta?: Record<string, unknown>;
  error?: Error | unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "jwt",
  "authorization",
  "cookie",
  "refreshtoken",
  "accesstoken",
  "secret",
  "jwt_access_secret",
  "database_url",
]);

export function sanitizeMetadata(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private formatLog(payload: LogPayload): string {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = payload.meta ? sanitizeMetadata(payload.meta) : undefined;
    let formattedError: Record<string, unknown> | undefined = undefined;

    if (payload.error) {
      if (payload.error instanceof Error) {
        formattedError = {
          name: payload.error.name,
          message: payload.error.message,
          ...(env.NODE_ENV !== "production" ? { stack: payload.error.stack } : {}),
        };
      } else {
        formattedError = { detail: String(payload.error) };
      }
    }

    const logEntry = {
      timestamp,
      level: payload.level,
      event: payload.event,
      message: payload.message,
      ...(payload.requestId ? { requestId: payload.requestId } : {}),
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
      ...(formattedError ? { error: formattedError } : {}),
    };

    return JSON.stringify(logEntry);
  }

  public info(event: string, message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (env.NODE_ENV === "test") return;
    const output = this.formatLog({ level: "INFO", event, message, meta, requestId });
    console.log(output);
  }

  public warn(event: string, message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (env.NODE_ENV === "test") return;
    const output = this.formatLog({ level: "WARN", event, message, meta, requestId });
    console.warn(output);
  }

  public error(
    event: string,
    message: string,
    error?: Error | unknown,
    meta?: Record<string, unknown>,
    requestId?: string
  ): void {
    if (env.NODE_ENV === "test") return;
    const output = this.formatLog({ level: "ERROR", event, message, error, meta, requestId });
    console.error(output);
  }
}

export const logger = new Logger();
