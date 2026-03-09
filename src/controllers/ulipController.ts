import type { Request, Response, NextFunction } from "express";
import { getVehicleDetailsFromUlip } from "../services/vehicleService";
import { getDriverDetailsFromUlip } from "../services/sarathiService";
import { getFastagDetailsFromUlip } from "../services/fastagService";
import { getEChallanDetailsFromUlip } from "../services/echallanService";
import { getMcaCompanyDetailsFromUlip } from "../services/mcaService";

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

export async function getDriverDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { dlnumber, dob } = req.body as { dlnumber: string; dob: string };
    const details = await getDriverDetailsFromUlip({ dlnumber, dob, requestId: req.id });

    res.status(200).json({
      requestId: req.id,
      data: {
        driver: details,
        source: "ULIP_SARATHI"
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getFastagDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { vehicleNumber } = req.body as { vehicleNumber: string };
    const details = await getFastagDetailsFromUlip({ vehicleNumber, requestId: req.id });

    res.status(200).json({
      requestId: req.id,
      data: {
        fastag: details,
        source: "ULIP_FASTAG"
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getEChallanDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { vehicleNumber } = req.body as { vehicleNumber: string };
    const details = await getEChallanDetailsFromUlip({ vehicleNumber, requestId: req.id });

    res.status(200).json({
      requestId: req.id,
      data: {
        echallan: details,
        source: "ULIP_ECHALLAN"
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getMcaDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { CIN } = req.body as { CIN: string };
    const details = await getMcaCompanyDetailsFromUlip({ CIN, requestId: req.id });

    res.status(200).json({
      requestId: req.id,
      data: details,
      source: "ULIP_MCA"
    });
  } catch (err) {
    next(err);
  }
}

