import { callUlip } from "./ulipClient";
import { ApiError } from "../utils/errors";
import { unwrapUlipPayload } from "./ulipPayload";

export interface EChallanOffence {
  act: string | null;
  name: string | null;
}

export interface EChallanRecord {
  challanNo: string | null;
  challanStatus: string | null;
  challanDateTime: string | null;
  challanPlace: string | null;
  stateCode: string | null;
  department: string | null;
  ownerName: string | null;
  violatorName: string | null;
  driverName: string | null;
  dlNo: string | null;
  fineImposed: string | null;
  amountOfFineImposed: string | null;
  receivedAmount: number | null;
  receiptNo: string | null;
  remark: string | null;
  sentToRegCourt: string | null;
  sentToVirtualCourt: string | null;
  sentToCourtOn: string | null;
  dateOfProceeding: string | null;
  courtName: string | null;
  courtAddress: string | null;
  rtoDistrictName: string | null;
  documentImpounded: string | null;
  offences: EChallanOffence[];
}

export interface EChallanDetails {
  vehicleNumber: string;
  status: string | null;
  message: string | null;
  pendingCount: number;
  disposedCount: number;
  pending: EChallanRecord[];
  disposed: EChallanRecord[];
}

function ensureObject(payload: unknown): Record<string, unknown> {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new ApiError({
    statusCode: 502,
    code: "ULIP_BAD_RESPONSE",
    message: "Unexpected ULIP ECHALLAN payload"
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAmount(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return String(value);
  return normalizeString(value);
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapOffences(value: unknown): EChallanOffence[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => {
    const obj = ensureObject(x);
    return {
      act: normalizeString(obj.act),
      name: normalizeString(obj.name)
    };
  });
}

function mapChallanRecord(value: unknown): EChallanRecord {
  const obj = ensureObject(value);
  return {
    challanNo: normalizeString(obj.challan_no),
    challanStatus: normalizeString(obj.challan_status),
    challanDateTime: normalizeString(obj.challan_date_time),
    challanPlace: normalizeString(obj.challan_place),
    stateCode: normalizeString(obj.state_code),
    department: normalizeString(obj.department),
    ownerName: normalizeString(obj.owner_name),
    violatorName: normalizeString(obj.name_of_violator),
    driverName: normalizeString(obj.driver_name),
    dlNo: normalizeString(obj.dl_no),
    fineImposed: normalizeAmount(obj.fine_imposed),
    amountOfFineImposed: normalizeAmount(obj.amount_of_fine_imposed),
    receivedAmount: normalizeNumber(obj.received_amount),
    receiptNo: normalizeString(obj.receipt_no),
    remark: normalizeString(obj.remark),
    sentToRegCourt: normalizeString(obj.sent_to_reg_court),
    sentToVirtualCourt: normalizeString(obj.sent_to_virtual_court),
    sentToCourtOn: normalizeString(obj.sent_to_court_on),
    dateOfProceeding: normalizeString(obj.date_of_proceeding),
    courtName: normalizeString(obj.court_name),
    courtAddress: normalizeString(obj.court_address),
    rtoDistrictName: normalizeString(obj.rto_distric_name),
    documentImpounded: normalizeString(obj.document_impounded),
    offences: mapOffences(obj.offence_details)
  };
}

export async function getEChallanDetailsFromUlip(params: {
  vehicleNumber: string;
  requestId?: string;
}): Promise<EChallanDetails> {
  const { vehicleNumber, requestId } = params;

  const ulipResponse = await callUlip<{ vehicleNumber: string }, any>({
    path: "ECHALLAN/01",
    body: { vehicleNumber: vehicleNumber },
    requestId
  });

  const payload = unwrapUlipPayload(ulipResponse);
  const root = ensureObject(payload);
  const data = root.data ? ensureObject(root.data) : {};

  const pendingRaw = Array.isArray(data.Pending_data) ? data.Pending_data : [];
  const disposedRaw = Array.isArray(data.Disposed_data) ? data.Disposed_data : [];

  const pending = pendingRaw.map(mapChallanRecord);
  const disposed = disposedRaw.map(mapChallanRecord);

  return {
    vehicleNumber,
    status: normalizeString(data.status),
    message: normalizeString(data.message),
    pendingCount: pending.length,
    disposedCount: disposed.length,
    pending,
    disposed
  };
}

