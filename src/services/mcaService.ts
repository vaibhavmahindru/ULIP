import { callUlip } from "./ulipClient";
import { ApiError } from "../utils/errors";

interface McaRecord {
  type?: string;
  [key: string]: unknown;
}

export interface McaFinancial {
  financialYear: string | null;
  financialRange: string | null;
  turnover: string | null;
  profitLoss: string | null;
}

export interface McaFounder {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fatherFirstName: string | null;
  fatherMidName: string | null;
  fatherLastName: string | null;
  associationStatus: string | null;
  din: string | null;
  dob: string | null;
  dinstatus: string | null;
  cin: string | null;
}

export interface McaCompany {
  companyName: string | null;
  cin: string | null;
  incorporationDate: string | null;
  companyStatus: string | null;
  rocname: string | null;
  emailAddress: string | null;
  contactNumber: string | null;
  address: {
    addressType: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    area: string | null;
    city: string | null;
    district: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
  };
  financials: McaFinancial[];
  founders: McaFounder[];
}

function normalize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.toLowerCase() === "null") return null;
    return trimmed;
  }
  return String(value);
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

function getResponseNode(ulipResponse: unknown): Record<string, unknown> {
  const root = ensureObject(ulipResponse, "Unexpected ULIP MCA response");
  const response = root.response;
  if (!Array.isArray(response) || response.length === 0) {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_BAD_RESPONSE",
      message: "ULIP MCA response is missing response array"
    });
  }
  return ensureObject(response[0], "ULIP MCA response item is invalid");
}

function extractMcaDataArray(ulipResponse: unknown, endpoint: "MCA/03" | "MCA/04"): McaRecord[] {
  const node = getResponseNode(ulipResponse);
  const responseStatus = normalize(node.responseStatus);
  if (responseStatus !== "SUCCESS") {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message: `${endpoint} returned non-success status`
    });
  }

  const responseObj = ensureObject(node.response, `${endpoint} response object missing`);
  const data = responseObj.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => typeof x === "object" && x !== null)
    .map((x) => x as McaRecord);
}

function mapFinancial(record: McaRecord): McaFinancial {
  return {
    financialYear: normalize(record.financialYear),
    financialRange: normalize(record.financialRange),
    turnover: normalize(record.turnover),
    profitLoss: normalize(record.profitLoss)
  };
}

function mapFounder(record: McaRecord): McaFounder {
  return {
    firstName: normalize(record.firstName),
    middleName: normalize(record.middleName),
    lastName: normalize(record.lastName),
    fatherFirstName: normalize(record.fatherFirstName),
    fatherMidName: normalize(record.fatherMidName),
    fatherLastName: normalize(record.fatherLastName),
    associationStatus: normalize(record.associationStatus),
    din: normalize(record.DIN),
    dob: normalize(record.DOB),
    dinstatus: normalize(record.DINStatus),
    cin: normalize(record.CIN)
  };
}

function mapCompany(companyRecord: McaRecord, cinFromRequest: string): McaCompany {
  return {
    companyName: normalize(companyRecord.companyName),
    cin: normalize(companyRecord.cin) ?? cinFromRequest,
    incorporationDate: normalize(companyRecord.incorporationDate),
    companyStatus: normalize(companyRecord.companyStatus),
    rocname: normalize(companyRecord.rocname),
    emailAddress: normalize(companyRecord.emailAddress),
    contactNumber: normalize(companyRecord.contactNumber),
    address: {
      addressType: normalize(companyRecord.addressType),
      addressLine1: normalize(companyRecord.addressLine1),
      addressLine2: normalize(companyRecord.addressLine2),
      area: normalize(companyRecord.area),
      city: normalize(companyRecord.city),
      district: normalize(companyRecord.district),
      state: normalize(companyRecord.state),
      country: normalize(companyRecord.country),
      pincode: normalize(companyRecord.pincode)
    },
    financials: [],
    founders: []
  };
}

export async function getMcaCompanyDetailsFromUlip(params: {
  CIN: string;
  requestId?: string;
}): Promise<{ company: McaCompany }> {
  const { CIN, requestId } = params;

  const [mca03Response, mca04Response] = await Promise.all([
    callUlip<{ CIN: string }, unknown>({
      path: "MCA/03",
      body: { CIN },
      requestId
    }),
    callUlip<{ CIN: string }, unknown>({
      path: "MCA/04",
      body: { CIN },
      requestId
    })
  ]);

  const mca03Data = extractMcaDataArray(mca03Response, "MCA/03");
  const companyRecord = mca03Data.find((r) => normalize(r.type) === "Company");
  const financialRecords = mca03Data.filter((r) => normalize(r.type) === "Balance Sheet");

  const company = mapCompany(companyRecord ?? {}, CIN);
  company.financials = financialRecords.map(mapFinancial);

  const mca04Data = extractMcaDataArray(mca04Response, "MCA/04");
  const founders: McaFounder[] = [];
  const seenDin = new Set<string>();

  for (const record of mca04Data) {
    const founder = mapFounder(record);
    const dinKey = founder.din ?? "";
    if (dinKey && seenDin.has(dinKey)) continue;
    if (dinKey) seenDin.add(dinKey);
    founders.push(founder);
  }

  company.founders = founders;

  return { company };
}

