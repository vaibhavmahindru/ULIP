import { callUlip } from "./ulipClient";
import { ApiError } from "../utils/errors";
import { unwrapUlipPayload } from "./ulipPayload";

export interface FastagTransaction {
  readerReadTime: string | null;
  seqNo: string | null;
  laneDirection: string | null;
  tollPlazaGeocode: string | null;
  tollPlazaName: string | null;
  vehicleType: string | null;
  vehicleRegNo: string | null;
}

export interface FastagTagDetails {
  tagId: string | null; // TAGID
  regNumber: string | null; // REGNUMBER
  tid: string | null; // TID
  vehicleClass: string | null; // VEHICLECLASS
  tagStatus: string | null; // TAGSTATUS
  issueDate: string | null; // ISSUEDATE
  excCode: string | null; // EXCCODE
  bankId: string | null; // BANKID
  commercialVehicleFlag: string | null; // COMVEHICLE
}

export interface FastagDetails {
  vehicleNumber: string;

  // Aggregated from FASTAG/01 & FASTAG/02
  result: string | null;
  respCode: string | null;
  timestamp: string | null;

  tagDetails: FastagTagDetails;

  vehicle: {
    errCode: string | null;
    totalTagsInMsg: string | null;
    msgNum: string | null;
    totalTagsInResponse: string | null;
    totalMsg: string | null;
    transactions: FastagTransaction[];
  };
}

function ensureObject(payload: unknown): Record<string, unknown> {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new ApiError({
    statusCode: 502,
    code: "ULIP_BAD_RESPONSE",
    message: "Unexpected ULIP FASTAG payload"
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapVehicledetailsToTagDetails(node: Record<string, unknown>): FastagTagDetails {
  const vehicledetailsRaw = node.vehicledetails;
  const detailsArray: Record<string, unknown>[] =
    Array.isArray(vehicledetailsRaw) && vehicledetailsRaw.length > 0
      ? (vehicledetailsRaw[0]?.detail as Record<string, unknown>[]) ?? []
      : [];

  const map: Record<string, string> = {};
  for (const d of detailsArray) {
    const name = normalizeString(d.name);
    const value = normalizeString(d.value);
    if (!name || value === null) continue;
    map[name] = value;
  }

  return {
    tagId: map.TAGID ?? null,
    regNumber: map.REGNUMBER ?? null,
    tid: map.TID ?? null,
    vehicleClass: map.VEHICLECLASS ?? null,
    tagStatus: map.TAGSTATUS ?? null,
    issueDate: map.ISSUEDATE ?? null,
    excCode: map.EXCCODE ?? null,
    bankId: map.BANKID ?? null,
    commercialVehicleFlag: map.COMVEHICLE ?? null
  };
}

export async function getFastagDetailsFromUlip(params: {
  vehicleNumber: string;
  requestId?: string;
}): Promise<FastagDetails> {
  const { vehicleNumber, requestId } = params;

  // FASTAG/01 – transaction history
  const ulipResponse01 = await callUlip<{ vehiclenumber: string }, any>({
    path: "FASTAG/01",
    body: { vehiclenumber: vehicleNumber },
    requestId
  });

  const payload01 = unwrapUlipPayload(ulipResponse01);
  const root01 = ensureObject(payload01);
  const vehicleNode01 = root01.vehicle ? ensureObject(root01.vehicle) : {};
  const vehltxnListNode =
    vehicleNode01.vehltxnList && typeof vehicleNode01.vehltxnList === "object"
      ? (vehicleNode01.vehltxnList as Record<string, unknown>)
      : {};

  const txnRaw = vehltxnListNode.txn;
  const transactions: FastagTransaction[] = Array.isArray(txnRaw)
    ? (txnRaw as Record<string, unknown>[]).map((t) => ({
        readerReadTime: (t.readerReadTime as string) ?? null,
        seqNo: (t.seqNo as string) ?? null,
        laneDirection: (t.laneDirection as string) ?? null,
        tollPlazaGeocode: (t.tollPlazaGeocode as string) ?? null,
        tollPlazaName: (t.tollPlazaName as string) ?? null,
        vehicleType: (t.vehicleType as string) ?? null,
        vehicleRegNo: (t.vehicleRegNo as string) ?? null
      }))
    : [];

  // FASTAG/02 – static tag/vehicle details
  const ulipResponse02 = await callUlip<{ vehiclenumber: string }, any>({
    path: "FASTAG/02",
    body: { vehiclenumber: vehicleNumber },
    requestId
  });

  const payload02 = unwrapUlipPayload(ulipResponse02);
  const root02 = ensureObject(payload02);
  const vehicleNode02 = root02.vehicle ? ensureObject(root02.vehicle) : {};
  const tagDetails = mapVehicledetailsToTagDetails(vehicleNode02);

  return {
    vehicleNumber,
    result: (root01.result as string) ?? null,
    respCode: (root01.respCode as string) ?? null,
    timestamp: (root01.ts as string) ?? null,
    tagDetails,
    vehicle: {
      errCode: (vehicleNode01.errCode as string) ?? null,
      totalTagsInMsg: (vehltxnListNode.totalTagsInMsg as string) ?? null,
      msgNum: (vehltxnListNode.msgNum as string) ?? null,
      totalTagsInResponse: (vehltxnListNode.totalTagsInresponse as string) ?? null,
      totalMsg: (vehltxnListNode.totalMsg as string) ?? null,
      transactions
    }
  };
}

