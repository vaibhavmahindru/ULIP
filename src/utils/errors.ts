export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "BUSINESS_RULE_VIOLATION"
  | "ULIP_TIMEOUT"
  | "ULIP_UNAVAILABLE"
  | "ULIP_BAD_RESPONSE"
  | "CIRCUIT_OPEN"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly expose: boolean;
  public readonly details?: unknown;

  constructor(opts: {
    statusCode: number;
    code: ApiErrorCode;
    message: string;
    expose?: boolean;
    details?: unknown;
  }) {
    super(opts.message);
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.expose = opts.expose ?? false;
    this.details = opts.details;
  }
}

