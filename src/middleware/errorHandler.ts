import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/errors";
import { logger } from "../utils/logger";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id;

  if (err instanceof ApiError) {
    logger.error(
      {
        requestId,
        err: {
          name: err.name,
          message: err.message,
          code: err.code,
          statusCode: err.statusCode,
          details: err.details
        }
      },
      "Request failed"
    );

    return res.status(err.statusCode).json({
      requestId,
      error: {
        code: err.code,
        message: err.expose ? err.message : "Request failed"
      }
    });
  }

  logger.error(
    {
      requestId,
      err: {
        name: err?.name,
        message: err?.message,
        stack: err?.stack
      }
    },
    "Unhandled error"
  );

  return res.status(500).json({
    requestId,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error"
    }
  });
};

