export type AppErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NOT_CONFIGURED"
  | "UPSTREAM";

const STATUS: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  UPSTREAM: 502,
};

/** Error with a safe, user-presentable message and an HTTP status. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export const notFound = (what = "Not found") => new AppError("NOT_FOUND", what);
export const forbidden = (why = "You do not have access to this resource") => new AppError("FORBIDDEN", why);
export const unauthenticated = (why = "Please sign in") => new AppError("UNAUTHENTICATED", why);
export const validation = (why: string) => new AppError("VALIDATION", why);
export const conflict = (why: string) => new AppError("CONFLICT", why);
export const rateLimited = (why = "Too many requests — please slow down") => new AppError("RATE_LIMITED", why);
export const notConfigured = (why: string) => new AppError("NOT_CONFIGURED", why);

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError || (typeof err === "object" && err !== null && (err as { name?: string }).name === "AppError");
}
