import { parseStringPromise } from "xml2js";
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

function extractUlipXmlFromVahanResponse(ulipResponse: any): string {
  const resp = ulipResponse?.response;
  if (Array.isArray(resp) && resp[0]?.response) {
    const payload = resp[0].response;
    if (typeof payload === "string") {
      if (payload === "Vehicle Details not Found") {
        throw new ApiError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: "Vehicle details not found",
          expose: true
        });
      }
      return payload;
    }
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
    path: "VAHAN/01",
    body: { vehiclenumber: vehicleNumber },
    requestId
  });

  const xml = extractUlipXmlFromVahanResponse(ulipResponse);

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,
    trim: true
  });

  const root = parsed?.VehicleDetails ?? parsed;

  const regNo =
    root?.rc_regn_no ?? root?.Regn_no ?? root?.registration_number ?? vehicleNumber;

  const details: VehicleDetails = {
    vehicleNumber: String(regNo),

    ownerName:
      root?.rc_owner_name ??
      root?.Owner_name ??
      root?.ownerName ??
      root?.owner_name ??
      null,
    address:
      root?.rc_permanent_address ??
      root?.Permanent_address ??
      root?.permanent_address ??
      null,
    status:
      root?.rc_status ??
      root?.Status ??
      root?.vehicleStatus ??
      root?.rc_status_as_on ??
      null,

    rcRegistrationDate: normalizeDate(
      root?.rc_regn_dt ?? root?.Registration_date ?? root?.registrationDate
    ),
    fitnessCertificateExpiry: normalizeDate(
      root?.rc_regn_upto ?? root?.Registration_valid_upto ?? root?.regn_valid_upto
    ),
    insuranceExpiry: normalizeDate(
      root?.rc_insurance_upto ?? root?.Insurance_valid_upto ?? root?.insuranceValidTill
    ),
    taxExpiry: normalizeDate(root?.rc_tax_upto ?? root?.Tax_valid_upto ?? null),
    permitExpiry: normalizeDate(
      root?.rc_permit_valid_upto ??
        root?.Permit_valid_upto ??
        root?.rc_permit_upto ??
        null
    ),
    puccExpiry: normalizeDate(
      root?.rc_pucc_upto ?? root?.PUCC_valid_upto ?? root?.pucc_valid_upto
    ),
    nationalPermitExpiry: normalizeDate(
      root?.rc_np_upto ?? root?.National_permit_valid_upto ?? root?.np_valid_upto
    ),

    permitType:
      root?.rc_permit_type ??
      root?.Permit_type ??
      root?.permit_type ??
      null,
    puccNumber:
      root?.rc_pucc_no ??
      root?.PUCC_no ??
      root?.pucc_no ??
      null,
    permitNumber:
      root?.rc_permit_no ??
      root?.Permit_no ??
      root?.permit_no ??
      null,
    insurer:
      root?.rc_insurance_comp ??
      root?.Insurance_comp ??
      root?.insurance_company ??
      null,
    insuranceNumber:
      root?.rc_insurance_policy_no ??
      root?.Insurance_policy_no ??
      root?.insurance_policy_no ??
      null,
    financier:
      root?.rc_financer ??
      root?.Financer ??
      root?.financier ??
      null,

    vehicleClass:
      root?.rc_vh_class_desc ??
      root?.Vehicle_class_desc ??
      root?.vehicleClass ??
      null,
    bodyType:
      root?.rc_body_type_desc ??
      root?.Body_type_desc ??
      root?.body_type ??
      null,
    fuelType: root?.rc_fuel_desc ?? root?.Fuel_desc ?? root?.fuelType ?? null,
    chassisNumber:
      root?.rc_chasi_no ?? root?.Chasi_no ?? root?.chassisNumber ?? null,
    engineNumber:
      root?.rc_eng_no ?? root?.Engine_no ?? root?.engineNumber ?? null,
    manufacturer:
      root?.rc_maker_desc ??
      root?.Maker_desc ??
      root?.manufacturer ??
      null,
    model:
      root?.rc_maker_model ??
      root?.Maker_model ??
      root?.model ??
      null,
    normsType:
      root?.rc_norms_desc ??
      root?.Norms_desc ??
      root?.norms_type ??
      null,
    vehicleCategory:
      root?.rc_vch_catg ??
      root?.Vehicle_category ??
      root?.vehicle_category ??
      null
  };

  return details;
}

