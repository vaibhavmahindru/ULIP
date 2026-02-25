import { Router } from "express";
import Joi from "joi";
import { internalApiKeyAuth } from "../middleware/internalAuth";
import { apiRateLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import {
  getVehicleDetailsHandler,
  getDriverDetailsHandler,
  getFastagDetailsHandler
} from "../controllers/ulipController";

const vehicleDetailsSchema = Joi.object({
  vehicleNumber: Joi.string().trim().min(4).max(32).required()
});

const sarathiSchema = Joi.object({
  dlnumber: Joi.string().trim().min(5).max(32).required(),
  dob: Joi.string()
    .trim()
    // YYYY-MM-DD
    .pattern(/^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/)
    .required()
});

const fastagSchema = Joi.object({
  vehicleNumber: Joi.string().trim().min(4).max(32).required()
});

export const ulipRouter = Router();

ulipRouter.post(
  "/ulip/v1/vehicle/details",
  internalApiKeyAuth,
  apiRateLimiter,
  validateBody(vehicleDetailsSchema),
  getVehicleDetailsHandler
);

ulipRouter.post(
  "/ulip/v1/driver/details",
  internalApiKeyAuth,
  apiRateLimiter,
  validateBody(sarathiSchema),
  getDriverDetailsHandler
);

ulipRouter.post(
  "/ulip/v1/fastag/details",
  internalApiKeyAuth,
  apiRateLimiter,
  validateBody(fastagSchema),
  getFastagDetailsHandler
);

