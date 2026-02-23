import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/errors";

export function internalApiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("x-internal-api-key");
  if (!key || key !== env.INTERNAL_API_KEY) {
    return next(
      new ApiError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Unauthorized",
        expose: true
      })
    );
  }
  next();
}

