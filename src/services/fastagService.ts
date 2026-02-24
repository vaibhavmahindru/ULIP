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

export interface FastagDetails {
  vehicleNumber: string;

  // From top-level FASTAG response
  result: string | null;
  respCode: string | null;
  timestamp: string | null;

  // Nested vehicle / transaction information
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

export async function getFastagDetailsFromUlip(params: {
  vehicleNumber: string;
  requestId?: string;
}): Promise<FastagDetails> {
  const { vehicleNumber, requestId } = params;

  const ulipResponse = await callUlip<{ vehiclenumber: string }, any>({
    path: "FASTAG/01",
    body: { vehiclenumber: vehicleNumber },
    requestId
  });


  const payload = unwrapUlipPayload(ulipResponse);
  const root = ensureObject(payload);
  const vehicleNode = root.vehicle ? ensureObject(root.vehicle) : {};
  const vehltxnListNode =
    vehicleNode.vehltxnList && typeof vehicleNode.vehltxnList === "object"
      ? (vehicleNode.vehltxnList as Record<string, unknown>)
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

  return {
    vehicleNumber,
    result: (root.result as string) ?? null,
    respCode: (root.respCode as string) ?? null,
    timestamp: (root.ts as string) ?? null,
    vehicle: {
      errCode: (vehicleNode.errCode as string) ?? null,
      totalTagsInMsg: (vehltxnListNode.totalTagsInMsg as string) ?? null,
      msgNum: (vehltxnListNode.msgNum as string) ?? null,
      totalTagsInResponse: (vehltxnListNode.totalTagsInresponse as string) ?? null,
      totalMsg: (vehltxnListNode.totalMsg as string) ?? null,
      transactions
    }
  };
}

