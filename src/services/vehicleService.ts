import { callUlip } from "./ulipClient";
import { ApiError } from "../utils/errors";

export interface VehicleDetails {
  vehicleNumber: string;

  // Direct business fields mapped from ULIP
  ownerName: string | null; // rc_owner_name
  address: string | null; // rc_permanent_address
  status: string | null; // rc_status

  rcRegistrationDate: string | null; // rc_regn_dt
  fitnessCertificateExpiry: string | null; // rc_regn_upto
  insuranceExpiry: string | null; // rc_insurance_upto
  taxExpiry: string | null; // rc_tax_upto
  permitExpiry: string | null; // rc_permit_valid_upto
  puccExpiry: string | null; // rc_pucc_upto
  nationalPermitExpiry: string | null; // rc_np_upto

  permitType: string | null; // rc_permit_type
  puccNumber: string | null; // rc_pucc_no
  permitNumber: string | null; // rc_permit_no
  insurer: string | null; // rc_insurance_comp
  insuranceNumber: string | null; // rc_insurance_policy_no
  financier: string | null; // rc_financer

  vehicleClass: string | null; // rc_vh_class_desc
  bodyType: string | null; // rc_body_type_desc
  fuelType: string | null; // rc_fuel_desc
  chassisNumber: string | null; // rc_chasi_no
  engineNumber: string | null; // rc_eng_no
  manufacturer: string | null; // rc_maker_desc
  model: string | null; // rc_maker_model
  normsType: string | null; // rc_norms_desc
  vehicleCategory: string | null; // rc_vch_catg
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Handles formats like "2026-02-25" and "03-Mar-2026 02:03:52663"
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  // Try known formats
  const parts = trimmed.split("-");
  if (parts.length === 3) {
    // DD-MM-YYYY or YYYY-MM-DD
    const [p0, , p2] = parts;
    if (p0 && p2 && p0.length === 2 && p2.length === 4) {
      const [d, m, y] = parts;
      return `${y}-${m}-${d}`;
    }
    if (p0 && p2 && p0.length === 4 && p2.length === 2) {
      return trimmed;
    }
  }
  return trimmed;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractVahanPayload(ulipResponse: any): Record<string, unknown> {
  const resp = ulipResponse?.response;
  let payload: unknown = undefined;

  if (Array.isArray(resp) && resp.length > 0) {
    payload = resp[0]?.response;
  } else if (resp && typeof resp === "object") {
    payload = (resp as any).response ?? resp;
  }

  if (typeof payload === "object" && payload !== null) {
    if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === "object") {
      return payload[0] as Record<string, unknown>;
    }
    if (!Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
  }

  if (typeof payload === "string" && payload.trim() === "Vehicle Details not Found") {
    throw new ApiError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Vehicle details not found",
      expose: true
    });
  }

  throw new ApiError({
    statusCode: 502,
    code: "ULIP_BAD_RESPONSE",
    message: "Unexpected ULIP VAHAN response structure"
  });
}

export async function getVehicleDetailsFromUlip(params: {
  vehicleNumber: string;
  requestId?: string;
}): Promise<VehicleDetails> {
  const { vehicleNumber, requestId } = params;

  const ulipResponse = await callUlip<{ vehiclenumber: string }, any>({
    path: "VAHAN/04",
    body: { vehiclenumber: vehicleNumber },
    requestId
  });

  const root = extractVahanPayload(ulipResponse);

  const regNo =
    (root.rcRegnNo as string | undefined) ??
    (root.rc_regn_no as string | undefined) ??
    (root.Regn_no as string | undefined) ??
    (root.registration_number as string | undefined) ??
    vehicleNumber;

  const details: VehicleDetails = {
    vehicleNumber: String(regNo),

    ownerName:
      normalizeString(root.rcOwnerName) ??
      normalizeString(root.rc_owner_name) ??
      normalizeString(root.Owner_name) ??
      normalizeString(root.ownerName) ??
      normalizeString(root.owner_name) ??
      null,
    address:
      normalizeString(root.rcPermanentAddress) ??
      normalizeString(root.rc_permanent_address) ??
      normalizeString(root.Permanent_address) ??
      normalizeString(root.permanent_address) ??
      null,
    status:
      normalizeString(root.rcStatus) ??
      normalizeString(root.rc_status) ??
      normalizeString(root.Status) ??
      normalizeString(root.vehicleStatus) ??
      normalizeString(root.rcStatusAsOn) ??
      normalizeString(root.rc_status_as_on) ??
      null,

    rcRegistrationDate: normalizeDate(
      root.rcRegnDt ?? root.rc_regn_dt ?? root.Registration_date ?? root.registrationDate
    ),
    fitnessCertificateExpiry: normalizeDate(
      root.rcRegnUpto ?? root.rc_regn_upto ?? root.Registration_valid_upto ?? root.regn_valid_upto
    ),
    insuranceExpiry: normalizeDate(
      root.rcInsuranceUpto ??
        root.rc_insurance_upto ??
        root.Insurance_valid_upto ??
        root.insuranceValidTill
    ),
    taxExpiry: normalizeDate(root.rcTaxUpto ?? root.rc_tax_upto ?? root.Tax_valid_upto ?? null),
    permitExpiry: normalizeDate(
      root.rcPermitValidUpto ??
        root.rc_permit_valid_upto ??
        root.Permit_valid_upto ??
        root.rc_permit_upto ??
        null
    ),
    puccExpiry: normalizeDate(
      root.rcPuccUpto ?? root.rc_pucc_upto ?? root.PUCC_valid_upto ?? root.pucc_valid_upto
    ),
    nationalPermitExpiry: normalizeDate(
      root.rcNpUpto ?? root.rc_np_upto ?? root.National_permit_valid_upto ?? root.np_valid_upto
    ),

    permitType:
      normalizeString(root.rcPermitType) ??
      normalizeString(root.rc_permit_type) ??
      normalizeString(root.Permit_type) ??
      normalizeString(root.permit_type) ??
      null,
    puccNumber:
      normalizeString(root.rcPuccNo) ??
      normalizeString(root.rc_pucc_no) ??
      normalizeString(root.PUCC_no) ??
      normalizeString(root.pucc_no) ??
      null,
    permitNumber:
      normalizeString(root.rcPermitNo) ??
      normalizeString(root.rc_permit_no) ??
      normalizeString(root.Permit_no) ??
      normalizeString(root.permit_no) ??
      null,
    insurer:
      normalizeString(root.rcInsuranceComp) ??
      normalizeString(root.rc_insurance_comp) ??
      normalizeString(root.Insurance_comp) ??
      normalizeString(root.insurance_company) ??
      null,
    insuranceNumber:
      normalizeString(root.rcInsurancePolicyNo) ??
      normalizeString(root.rc_insurance_policy_no) ??
      normalizeString(root.Insurance_policy_no) ??
      normalizeString(root.insurance_policy_no) ??
      null,
    financier:
      normalizeString(root.rcFinancer) ??
      normalizeString(root.rc_financer) ??
      normalizeString(root.Financer) ??
      normalizeString(root.financier) ??
      null,

    vehicleClass:
      normalizeString(root.rcVhClassDesc) ??
      normalizeString(root.rc_vh_class_desc) ??
      normalizeString(root.Vehicle_class_desc) ??
      normalizeString(root.vehicleClass) ??
      null,
    bodyType:
      normalizeString(root.rcBodyTypeDesc) ??
      normalizeString(root.rc_body_type_desc) ??
      normalizeString(root.Body_type_desc) ??
      normalizeString(root.body_type) ??
      null,
    fuelType:
      normalizeString(root.rcFuelDesc) ??
      normalizeString(root.rc_fuel_desc) ??
      normalizeString(root.Fuel_desc) ??
      normalizeString(root.fuelType) ??
      null,
    chassisNumber:
      normalizeString(root.rcChasiNo) ??
      normalizeString(root.rc_chasi_no) ??
      normalizeString(root.Chasi_no) ??
      normalizeString(root.chassisNumber) ??
      null,
    engineNumber:
      normalizeString(root.rcEngNo) ??
      normalizeString(root.rc_eng_no) ??
      normalizeString(root.Engine_no) ??
      normalizeString(root.engineNumber) ??
      null,
    manufacturer:
      normalizeString(root.rcMakerDesc) ??
      normalizeString(root.rc_maker_desc) ??
      normalizeString(root.Maker_desc) ??
      normalizeString(root.manufacturer) ??
      null,
    model:
      normalizeString(root.rcMakerModel) ??
      normalizeString(root.rc_maker_model) ??
      normalizeString(root.Maker_model) ??
      normalizeString(root.model) ??
      null,
    normsType:
      normalizeString(root.rcNormsDesc) ??
      normalizeString(root.rc_norms_desc) ??
      normalizeString(root.Norms_desc) ??
      normalizeString(root.norms_type) ??
      null,
    vehicleCategory:
      normalizeString(root.rcVchCatg) ??
      normalizeString(root.rc_vch_catg) ??
      normalizeString(root.Vehicle_category) ??
      normalizeString(root.vehicle_category) ??
      null
  };

  return details;
}

