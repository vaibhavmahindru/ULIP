# Internal API reference

This document describes every HTTP surface of the ULIP gateway: authentication, request/response shapes, upstream mapping (ULIP path or external URL), validation rules, and error semantics.

For deployment, environment variables, and operations, see [README.md](./README.md).

---

## Base URL and routing

- There is **no global path prefix**. Routes are mounted at the application root (for example `http://127.0.0.1:4000/health`).
- Replace host and port with your Nginx public URL in production.

---

## Authentication

| Endpoint group | Required headers |
|----------------|------------------|
| `GET /health` | None |
| All `POST /ulip/v1/...` routes | `X-Internal-API-Key: <INTERNAL_API_KEY>` and `Content-Type: application/json` |

The internal API key is a shared secret between your backend and this service. It is **not** the ULIP bearer token; the gateway obtains the ULIP token using `ULIP_USERNAME` / `ULIP_PASSWORD` from the environment.

---

## Rate limiting

Protected `POST` routes use **express-rate-limit** with:

- Window: `RATE_LIMIT_WINDOW_MS` (default 60 seconds)
- Max requests per client IP: `RATE_LIMIT_MAX` (default 60)

When exceeded, the response is **429** with body shaped like:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests"
  }
}
```

(The rate-limit middleware may not attach `requestId` to that payload; treat it as infrastructure-level throttling.)

---

## Request correlation

Successful and error responses from normal request handlers include:

- **`requestId`**: UUID generated per request (middleware). Use it in logs and when reporting issues to ULIP.

---

## Success response conventions

Most ULIP-backed routes return **`source` inside `data`** together with the normalized resource:

```json
{
  "requestId": "<uuid>",
  "data": {
    "<resourceKey>": { },
    "source": "ULIP_<NAME>"
  }
}
```

**Exceptions:**

1. **MCA** (`POST /ulip/v1/mca/details`): `source` is at the **top level** next to `data`:

   ```json
   {
     "requestId": "<uuid>",
     "data": { "company": { } },
     "source": "ULIP_MCA"
   }
   ```

2. **HDFC FASTag** (`POST /ulip/v1/hdfc-fastag`): `source` is at the **top level**; the payload is the HDFC API response inside `data.hdfcFastag`:

   ```json
   {
     "requestId": "<uuid>",
     "data": { "hdfcFastag": { } },
     "source": "HDFC_FASTAG"
   }
   ```

---

## Error response convention

Application errors use:

```json
{
  "requestId": "<uuid>",
  "error": {
    "code": "<ApiErrorCode>",
    "message": "<human-readable>"
  }
}
```

Validation failures return **422** with `code: "VALIDATION_ERROR"`. The handler logs Joi `details`; the JSON body may only include the generic message unless extended later.

---

## Error codes (reference)

| HTTP | `code` | When |
|------|--------|------|
| 401 | `UNAUTHORIZED` | Missing or wrong `X-Internal-API-Key` |
| 422 | `VALIDATION_ERROR` | Body failed Joi validation |
| 429 | `RATE_LIMITED` | Too many requests from this IP |
| 400 | `BUSINESS_RULE_VIOLATION` | Domain rule (e.g. SARATHI licence not active/expired) |
| 502 | `ULIP_UNAVAILABLE` | ULIP or HDFC upstream error, non-success business status, circuit-related failure surfaced as unavailable |
| 502 | `ULIP_BAD_RESPONSE` | ULIP returned an unexpected envelope or payload |
| 504 | `ULIP_TIMEOUT` | ULIP HTTP client timeout after retries |
| 503 | `CIRCUIT_OPEN` | Circuit breaker open (when enabled) |
| 404 | `NOT_FOUND` | Unknown path |
| 500 | `INTERNAL_ERROR` | Unhandled exception |

---

## Quick reference

| Method | Path | Upstream | Auth |
|--------|------|----------|------|
| GET | `/health` | — | No |
| POST | `/ulip/v1/vehicle/details` | ULIP `VAHAN/04` | Yes |
| POST | `/ulip/v1/driver/details` | ULIP `SARATHI/01` | Yes |
| POST | `/ulip/v1/fastag/details` | ULIP `FASTAG/01` + `FASTAG/02` | Yes |
| POST | `/ulip/v1/echallan/details` | ULIP `ECHALLAN/01` | Yes |
| POST | `/ulip/v1/ewaybill/details` | ULIP `EWAYBILL/01` | Yes |
| POST | `/ulip/v1/mca/details` | ULIP `MCA/03` + `MCA/04` (parallel) | Yes |
| POST | `/ulip/v1/hdfc-fastag` | HDFC Corp Tag API (external) | Yes |

Optional timeout env vars (each falls back to `ULIP_TIMEOUT_MS`): `ULIP_TIMEOUT_VAHAN_MS`, `ULIP_TIMEOUT_SARATHI_MS`, `ULIP_TIMEOUT_FASTAG_MS`, `ULIP_TIMEOUT_ECHALLAN_MS`, `ULIP_TIMEOUT_EWAYBILL_MS`, plus `ULIP_TIMEOUT_LOGIN_MS` for login.

---

## Health check

- **Method:** `GET`
- **Path:** `/health`
- **Auth:** none

### Response (200)

```json
{
  "status": "ok"
}
```

---

## Vehicle details (ULIP `VAHAN/04`)

- **Method:** `POST`
- **Path:** `/ulip/v1/vehicle/details`

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `vehicleNumber` | string | Trimmed, length 4–32 |

```json
{
  "vehicleNumber": "UP32KH0320"
}
```

### Response (200)

Normalized VAHAN fields under `data.vehicle`. `data.source` is `ULIP_VAHAN`.

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "data": {
    "vehicle": {
      "vehicleNumber": "UP32KH0320",
      "ownerName": "L***I D**I",
      "address": "Lucknow, 226001",
      "status": "ACTIVE",
      "rcRegistrationDate": "2018-12-06",
      "fitnessCertificateExpiry": "2033-12-05",
      "insuranceExpiry": "2023-11-08",
      "taxExpiry": null,
      "permitExpiry": null,
      "puccExpiry": "2026-08-22",
      "nationalPermitExpiry": null,
      "permitType": null,
      "puccNumber": "UP03202000024411",
      "permitNumber": null,
      "insurer": "ICICI  LOMBARD",
      "insuranceNumber": "3005/42716914/11617/000",
      "financier": null,
      "vehicleClass": "M-Cycle/Scooter",
      "bodyType": "SOLO WITH PILLION",
      "fuelType": "PETROL",
      "chassisNumber": "MBLHAR087JHK*****",
      "engineNumber": "HA10AGJHK*****",
      "manufacturer": "HERO MOTOCORP LTD",
      "model": "SPLENDOR + (SELF-DRUM-CAST)",
      "normsType": "BHARAT STAGE IV",
      "vehicleCategory": "2WN"
    },
    "source": "ULIP_VAHAN"
  }
}
```

---

## Driver details (ULIP `SARATHI/01`)

- **Method:** `POST`
- **Path:** `/ulip/v1/driver/details`

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `dlnumber` | string | Trimmed, length 5–32 |
| `dob` | string | `YYYY-MM-DD` |

```json
{
  "dlnumber": "HR51 20210018922",
  "dob": "1987-05-26"
}
```

### Response (200)

```json
{
  "requestId": "22222222-3333-4444-5555-666666666666",
  "data": {
    "driver": {
      "dl_number": "HR51 20210018922",
      "dob": "1987-05-26",
      "full_name": "V*I*H*V* *A*I*D*U",
      "blood_group": "B+",
      "address_line_1": "H*O* *5*/* *E*T*R*7*B",
      "address_line_2": "B*H*N* *U*T* *W*E*",
      "gender": "Male",
      "bio_id": "270401VAIMAHMANIK",
      "issued_at": "2021-07-20",
      "valid_from": "2021-07-20",
      "valid_to": "2041-04-26",
      "licence_status": "Active",
      "rto_name": "RLA FARIDABAD (NT)",
      "rto_code": "HR51",
      "categories": [
        {
          "licence_number": "HR51 20210018922",
          "application_number": "2220004221",
          "cov_issue_date": "2021-07-20",
          "cov_office_name": "RLA FARIDABAD (NT)",
          "vehicle_type_abbr": "LMV",
          "vehicle_type_description": "LIGHT MOTOR VEHICLE"
        }
      ]
    },
    "source": "ULIP_SARATHI"
  }
}
```

### Business rule errors (400)

Returned when the licence is not active or `valid_to` is missing/expired:

```json
{
  "requestId": "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Licence has expired"
  }
}
```

---

## FASTag details (ULIP `FASTAG/01` + `FASTAG/02`)

- **Method:** `POST`
- **Path:** `/ulip/v1/fastag/details`

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `vehicleNumber` | string | Trimmed, length 4–32 |

```json
{
  "vehicleNumber": "HR38AF9143"
}
```

### Response (200)

Combined tag + transaction summary under `data.fastag`. `data.source` is `ULIP_FASTAG`.

```json
{
  "requestId": "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
  "data": {
    "fastag": {
      "vehicleNumber": "HR38AF9143",
      "result": "SUCCESS",
      "respCode": "000",
      "timestamp": "2026-02-25T13:40:32",
      "tagDetails": {
        "tagId": "34161FA820328C740276BDC0",
        "regNumber": "HR38AF9143",
        "tid": "E20034120136030011339437",
        "vehicleClass": "VC14",
        "tagStatus": "A",
        "issueDate": "2023-05-30",
        "excCode": "00",
        "bankId": "607802",
        "commercialVehicleFlag": "T"
      },
      "vehicle": {
        "errCode": "000",
        "totalTagsInMsg": "9",
        "msgNum": "1",
        "totalTagsInResponse": "9",
        "totalMsg": "1",
        "transactions": [
          {
            "readerReadTime": "2026-02-21 13:22:09.000",
            "seqNo": "0010002602211322285945",
            "laneDirection": "W",
            "tollPlazaGeocode": "25.5871683,74.593839",
            "tollPlazaName": "Lambiya Kalan",
            "vehicleType": "VC14",
            "vehicleRegNo": "HR38AF9143"
          }
        ]
      }
    },
    "source": "ULIP_FASTAG"
  }
}
```

---

## E-Challan details (ULIP `ECHALLAN/01`)

- **Method:** `POST`
- **Path:** `/ulip/v1/echallan/details`

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `vehicleNumber` | string | Trimmed, length 4–32 |

The gateway sends both `vehicleNumber` and `vehiclenumber` to ULIP for compatibility.

```json
{
  "vehicleNumber": "KL07AB1234"
}
```

### Response (200)

```json
{
  "requestId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "data": {
    "echallan": {
      "vehicleNumber": "KL07AB1234",
      "status": "200",
      "message": "Record finds successfully",
      "pendingCount": 2,
      "disposedCount": 2,
      "pending": [
        {
          "challanNo": "KL548476230713105383",
          "challanStatus": "Pending",
          "challanDateTime": "01-09-2023 17:36:00",
          "challanPlace": "test",
          "stateCode": "KL",
          "department": "Traffic",
          "ownerName": "T**T P*T L*D",
          "violatorName": "T**T P*T L*D",
          "driverName": null,
          "dlNo": null,
          "fineImposed": "7750",
          "amountOfFineImposed": null,
          "receivedAmount": null,
          "receiptNo": null,
          "remark": "gdgg",
          "sentToRegCourt": "No",
          "sentToVirtualCourt": "No",
          "sentToCourtOn": null,
          "dateOfProceeding": null,
          "courtName": null,
          "courtAddress": null,
          "rtoDistrictName": "Thiruvananthapuram",
          "documentImpounded": null,
          "offences": [
            {
              "act": "S130(4)",
              "name": "Fitness certificate (CF) of a transport vehicle not produced on demand for examination by the officer authorised."
            }
          ]
        }
      ],
      "disposed": [
        {
          "challanNo": "KL48648220311113821",
          "challanStatus": "Disposed",
          "challanDateTime": "11-03-2022 11:38:21",
          "challanPlace": null,
          "stateCode": "KL",
          "department": "Traffic",
          "ownerName": "T**T P*T L*D",
          "violatorName": "T**T P*T L*D",
          "driverName": "T**T P*T L*D",
          "dlNo": null,
          "fineImposed": "1",
          "amountOfFineImposed": null,
          "receivedAmount": 1,
          "receiptNo": null,
          "remark": "NA",
          "sentToRegCourt": "No",
          "sentToVirtualCourt": "No",
          "sentToCourtOn": null,
          "dateOfProceeding": null,
          "courtName": null,
          "courtAddress": null,
          "rtoDistrictName": null,
          "documentImpounded": null,
          "offences": [
            {
              "act": null,
              "name": "test offence 1 rupee"
            }
          ]
        }
      ]
    },
    "source": "ULIP_ECHALLAN"
  }
}
```

---

## E-Way Bill details (ULIP `EWAYBILL/01`)

- **Method:** `POST`
- **Path:** `/ulip/v1/ewaybill/details`

Fetches e-way bill metadata by number. ULIP returns a nested envelope (`response[]` with `responseStatus` and inner `response`); the gateway requires `responseStatus === "SUCCESS"` and maps fields to a stable JSON shape.

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `ewbNo` | string | Digits only, length 8–16 after trim |

```json
{
  "ewbNo": "101000609218"
}
```

### Mapped response fields (`data.ewaybill`)

| Field | Type | Notes |
|-------|------|--------|
| `ewbNo` | string | From ULIP; falls back to request value if missing |
| `status` | string \| null | e.g. bill status `ACT` |
| `ewayBillDate` | string \| null | As returned by ULIP (display format) |
| `validUpto` | string \| null | Validity end |
| `fromPincode` | number \| null | |
| `toPincode` | number \| null | |
| `hsnCode` | string \| null | Empty strings normalized to `null` |
| `errorCodes` | string \| null | Preserved or JSON-stringified if array |
| `vehicles` | array | From ULIP `VehiclListDetails` (typo preserved upstream) |

Each element of `vehicles`:

| Field | Type | ULIP source key |
|-------|------|------------------|
| `vehicleNumber` | string \| null | `vehicleNo` |
| `enteredDate` | string \| null | `enteredDate` |
| `transMode` | string \| null | `transMode` |

### Response (200) — example

```json
{
  "requestId": "cccccccc-dddd-eeee-ffff-000000000001",
  "data": {
    "ewaybill": {
      "ewbNo": "101000609218",
      "status": "ACT",
      "ewayBillDate": "29/11/2017 04:30:00 PM",
      "validUpto": "29/11/2017 11:59:00 PM",
      "fromPincode": 301404,
      "toPincode": 302014,
      "hsnCode": null,
      "errorCodes": null,
      "vehicles": [
        {
          "vehicleNumber": "RJ14CG4508",
          "enteredDate": "29/11/2017 04:30:00 PM",
          "transMode": "1"
        }
      ]
    },
    "source": "ULIP_EWAYBILL"
  }
}
```

### Upstream failure

If ULIP sets `responseStatus` to something other than `SUCCESS`, the gateway responds with **502** and `ULIP_UNAVAILABLE`, using ULIP’s `message` when present.

---

## MCA company details (ULIP `MCA/03` + `MCA/04`)

- **Method:** `POST`
- **Path:** `/ulip/v1/mca/details`

Calls **`MCA/03`** and **`MCA/04`** in **parallel**, merges company + balance-sheet rows + directors/founders (deduplicated by DIN).

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `CIN` | string | Trimmed, length 5–64 |

```json
{
  "CIN": "U74999DL2019PTC348888"
}
```

### Response (200)

`data.company` contains:

- Identity: `companyName`, `cin`, `incorporationDate`, `companyStatus`, `rocname`, `emailAddress`, `contactNumber`
- `address`: `addressType`, `addressLine1`, `addressLine2`, `area`, `city`, `district`, `state`, `country`, `pincode`
- `financials[]`: `financialYear`, `financialRange`, `turnover`, `profitLoss`
- `founders[]`: `firstName`, `middleName`, `lastName`, `fatherFirstName`, `fatherMidName`, `fatherLastName`, `associationStatus`, `din`, `dob`, `dinstatus`, `cin`

**Note:** `source` is **top-level** `ULIP_MCA`, not inside `data`.

```json
{
  "requestId": "dddddddd-eeee-ffff-0000-111111111111",
  "data": {
    "company": {
      "companyName": "Example Pvt Ltd",
      "cin": "U74999DL2019PTC348888",
      "incorporationDate": "2019-01-15",
      "companyStatus": "Active",
      "rocname": null,
      "emailAddress": null,
      "contactNumber": null,
      "address": {
        "addressType": null,
        "addressLine1": null,
        "addressLine2": null,
        "area": null,
        "city": null,
        "district": null,
        "state": null,
        "country": null,
        "pincode": null
      },
      "financials": [],
      "founders": []
    }
  },
  "source": "ULIP_MCA"
}
```

---

## HDFC FASTag transactions (external HDFC API)

- **Method:** `POST`
- **Path:** `/ulip/v1/hdfc-fastag`

This route **does not call ULIP**. It proxies to HDFC’s corporate FASTag wallet transaction API. Request/response formats are dictated by HDFC; the gateway forwards a fixed body template (wallet/merchant IDs, etc.) and returns HDFC’s JSON as `data.hdfcFastag`.

### Request body

| Field | Type | Rules |
|-------|------|--------|
| `fromDate` | string | Format expected by HDFC (e.g. `YYYYMMDD HHMMSS`) |
| `toDate` | string | Same as above |
| `vehicleNumber` | string | Trimmed, length 4–32 |

```json
{
  "fromDate": "20260201 000000",
  "toDate": "20260225 235959",
  "vehicleNumber": "HR38AF9143"
}
```

### Response (200)

Shape depends on HDFC. Top-level `source` is `HDFC_FASTAG`.

```json
{
  "requestId": "eeeeeeee-ffff-0000-1111-222222222222",
  "data": {
    "hdfcFastag": {}
  },
  "source": "HDFC_FASTAG"
}
```

Upstream HTTP or API errors surface as **502** with `ULIP_UNAVAILABLE` and a message derived from HDFC’s error payload when available.

---

## Example: local cURL (E-Way Bill)

```bash
curl --location 'http://127.0.0.1:4000/ulip/v1/ewaybill/details' \
  --header 'X-Internal-API-Key: YOUR_INTERNAL_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"ewbNo":"101000609218"}'
```

Use the same pattern for other `POST` routes: set headers and a JSON body matching the tables above.

---

## Sample error payloads

### Validation error (422)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body"
  }
}
```

### Unauthorized (401)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized"
  }
}
```

### ULIP timeout (504)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "ULIP_TIMEOUT",
    "message": "ULIP request timed out"
  }
}
```

### ULIP unavailable / bad upstream (502)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "ULIP_UNAVAILABLE",
    "message": "ULIP request failed"
  }
}
```

### Circuit open (503, when enabled)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "CIRCUIT_OPEN",
    "message": "ULIP temporarily unavailable"
  }
}
```
