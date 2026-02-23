import { Router } from "express";
import Joi from "joi";
import { internalApiKeyAuth } from "../middleware/internalAuth";
import { apiRateLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { getVehicleDetailsHandler } from "../controllers/ulipController";

const vehicleDetailsSchema = Joi.object({
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

