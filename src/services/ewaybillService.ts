import { callUlip } from "./ulipClient";
import { ApiError } from "../utils/errors";

export interface EwaybillVehicle {
  vehicleNumber: string | null;
  enteredDate: string | null;
  transMode: string | null;
}

export interface EwaybillDetails {
  ewbNo: string;
  status: string | null;
  ewayBillDate: string | null;
  validUpto: string | null;
  fromPincode: number | null;
  toPincode: number | null;
  hsnCode: string | null;
  errorCodes: string | null;
  vehicles: EwaybillVehicle[];
}

function ensureObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new ApiError({
    statusCode: 502,
    code: "ULIP_BAD_RESPONSE",
    message
  });
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value);
}

function normalizePincode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeErrorCodes(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : null;
  return null;
}

function getFirstResponseItem(ulipResponse: unknown): Record<string, unknown> {
  const root = ensureObject(ulipResponse, "Unexpected ULIP EWAYBILL response");
  const errorFlag = root.error;
  if (errorFlag && String(errorFlag).toLowerCase() === "true") {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message: "ULIP returned an error"
    });
  }
  const response = root.response;
  if (!Array.isArray(response) || response.length === 0) {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_BAD_RESPONSE",
      message: "ULIP EWAYBILL response is missing response array"
    });
  }
  return ensureObject(response[0], "ULIP EWAYBILL response item is invalid");
}

function mapVehicles(value: unknown): EwaybillVehicle[] {
  const raw = Array.isArray(value) ? value : [];
  return raw.map((item) => {
    const o = ensureObject(item, "Invalid vehicle row in EWAYBILL");
    return {
      vehicleNumber: normalizeString(o.vehicleNo),
      enteredDate: normalizeString(o.enteredDate),
      transMode: normalizeString(o.transMode)
    };
  });
}

export async function getEwaybillDetailsFromUlip(params: {
  ewbNo: string;
  requestId?: string;
}): Promise<EwaybillDetails> {
  const { ewbNo, requestId } = params;

  const ulipResponse = await callUlip<{ ewbNo: string }, unknown>({
    path: "EWAYBILL/01",
    body: { ewbNo },
    requestId
  });

  const item = getFirstResponseItem(ulipResponse);
  const responseStatus = normalizeString(item.responseStatus);
  if (responseStatus !== "SUCCESS") {
    const msg = normalizeString(item.message);
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message: msg ?? "EWAYBILL returned non-success status"
    });
  }

  const inner = ensureObject(item.response, "EWAYBILL payload missing");

  return {
    ewbNo: normalizeString(inner.ewbNo) ?? ewbNo,
    status: normalizeString(inner.status),
    ewayBillDate: normalizeString(inner.ewayBillDate),
    validUpto: normalizeString(inner.validUpto),
    fromPincode: normalizePincode(inner.fromPincode),
    toPincode: normalizePincode(inner.toPincode),
    hsnCode: normalizeString(inner.hsnCode),
    errorCodes: normalizeErrorCodes(inner.errorCodes),
    vehicles: mapVehicles(inner.VehiclListDetails)
  };
}
