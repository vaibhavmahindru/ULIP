import { callUlip } from "./ulipClient";
import { ApiError } from "../utils/errors";
import { unwrapUlipPayload } from "./ulipPayload";

export interface LicenceVehicleCategory {
  licence_number: string | null;
  application_number: string | null;
  cov_issue_date: string | null; // ISO YYYY-MM-DD
  cov_office_name: string | null;
  vehicle_type_abbr: string | null;
  vehicle_type_description: string | null;
}

export interface Licence {
  dl_number: string;
  dob: string;

  full_name: string | null;
  blood_group: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  gender: string | null;

  bio_id: string | null;
  issued_at: string | null; // ISO YYYY-MM-DD
  valid_from: string | null; // ISO YYYY-MM-DD
  valid_to: string | null; // ISO YYYY-MM-DD
  licence_status: string | null;
  rto_name: string | null;
  rto_code: string | null;

  categories: LicenceVehicleCategory[];
}

function ensureObject(payload: unknown): Record<string, unknown> {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  throw new ApiError({
    statusCode: 502,
    code: "ULIP_BAD_RESPONSE",
    message: "Unexpected ULIP SARATHI payload"
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: unknown): string | null {
  const str = normalizeString(value);
  if (!str) return null;

  // Try direct Date parsing first (covers ISO and many common formats)
  const direct = new Date(str);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  // Try DD-MM-YYYY
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const m1 = str.match(ddmmyyyy);
  if (m1) {
    const [, d, m, y] = m1;
    return `${y}-${m}-${d}`;
  }

  return str;
}

export async function getDriverDetailsFromUlip(params: {
  dlnumber: string;
  dob: string; // YYYY-MM-DD
  requestId?: string;
}): Promise<Licence> {
  const { dlnumber, dob, requestId } = params;

  const ulipResponse = await callUlip<{ dlnumber: string; dob: string }, any>({
    path: "SARATHI/01",
    body: { dlnumber, dob },
    requestId
  });

  const payload = unwrapUlipPayload(ulipResponse);
  const root = ensureObject(payload);

  const dldetRaw = (root as any).dldetobj;
  const dldetobj: Record<string, unknown> =
    Array.isArray(dldetRaw) && dldetRaw.length > 0
      ? ensureObject(dldetRaw[0])
      : dldetRaw
        ? ensureObject(dldetRaw)
        : {};
  const bioObj = dldetobj.bioObj ? ensureObject(dldetobj.bioObj) : {};
  const dlobj = dldetobj.dlobj ? ensureObject(dldetobj.dlobj) : {};

  const rawStatus = normalizeString(dlobj.dlStatus);
  const licence_status = rawStatus;

  const valid_to = normalizeDate(dlobj.dlNtValdtoDt);

  // Business validation: licence must be active and not expired
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const today = new Date(todayIso);

  if (!licence_status || licence_status.toLowerCase() !== "active") {
    throw new ApiError({
      statusCode: 400,
      code: "BUSINESS_RULE_VIOLATION",
      message: "Licence is not active",
      expose: true
    });
  }

  if (!valid_to) {
    throw new ApiError({
      statusCode: 400,
      code: "BUSINESS_RULE_VIOLATION",
      message: "Licence validity end date missing",
      expose: true
    });
  }

  const validToDate = new Date(valid_to);
  if (!(validToDate > today)) {
    throw new ApiError({
      statusCode: 400,
      code: "BUSINESS_RULE_VIOLATION",
      message: "Licence has expired",
      expose: true
    });
  }

  const bio_id = normalizeString(dlobj.bioid);
  const issued_at = normalizeDate(dlobj.dlIssuedt);
  const valid_from = normalizeDate(dlobj.dlNtValdfrDt);
  const rto_name = normalizeString(dlobj.omRtoFullname);
  const rto_code = normalizeString(dlobj.dlRtoCode);

  const full_name = normalizeString(bioObj.bioFullName);
  const blood_group = normalizeString(bioObj.bioBloodGroup);
  const address_line_1 = normalizeString(bioObj.bioPermAdd1);
  const address_line_2 = normalizeString(bioObj.bioPermAdd2);
  const gender = normalizeString(bioObj.bioGenderDesc);

  // dlcovs is a list of endorsements / vehicle categories
  const dlcovsRaw = dldetobj.dlcovs;
  const dlcovArray: Record<string, unknown>[] = Array.isArray(dlcovsRaw)
    ? (dlcovsRaw as Record<string, unknown>[])
    : dlcovsRaw && typeof dlcovsRaw === "object"
      ? [dlcovsRaw as Record<string, unknown>]
      : [];

  const categories: LicenceVehicleCategory[] = [];
  const seenKeys = new Set<string>();

  for (const cov of dlcovArray) {
    const licence_number = normalizeString(cov.dcLicno);
    const application_number = normalizeString(cov.dcApplno);
    const cov_issue_date = normalizeDate(cov.dcIssuedt);
    const cov_office_name = normalizeString(cov.olaName);
    const vehicle_type_abbr = normalizeString(cov.covabbrv);
    const vehicle_type_description = normalizeString(cov.covdesc);

    const dedupeKey = [
      licence_number ?? "",
      vehicle_type_abbr ?? "",
      vehicle_type_description ?? ""
    ].join("|");

    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    categories.push({
      licence_number,
      application_number,
      cov_issue_date,
      cov_office_name,
      vehicle_type_abbr,
      vehicle_type_description
    });
  }

  return {
    dl_number: dlnumber,
    dob,
    full_name,
    blood_group,
    address_line_1,
    address_line_2,
    gender,
    bio_id,
    issued_at,
    valid_from,
    valid_to,
    licence_status,
    rto_name,
    rto_code,
    categories
  };
}

