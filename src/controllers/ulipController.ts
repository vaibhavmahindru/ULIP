import type { Request, Response, NextFunction } from "express";
import { getVehicleDetailsFromUlip } from "../services/vehicleService";

export async function getVehicleDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { vehicleNumber } = req.body as { vehicleNumber: string };
    const details = await getVehicleDetailsFromUlip({
      vehicleNumber,
      requestId: req.id
    });

    res.status(200).json({
      requestId: req.id,
      data: {
        vehicle: details,
        source: "ULIP_VAHAN"
      }
    });
  } catch (err) {
    next(err);
  }
}

