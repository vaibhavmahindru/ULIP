import type { Request, Response, NextFunction } from "express";
import type Joi from "joi";
import { ApiError } from "../utils/errors";

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { value, error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    if (error) {
      return next(
        new ApiError({
          statusCode: 422,
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          expose: true,
          details: error.details.map((d) => ({
            message: d.message,
            path: d.path
          }))
        })
      );
    }
    req.body = value;
    next();
  };
}

