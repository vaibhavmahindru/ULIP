# Internal API Documentation

All protected endpoints require:

- Header: `X-Internal-API-Key: <your INTERNAL_API_KEY>`
- Header: `Content-Type: application/json`

Common response envelope:

- Success: `{ "requestId": "...", "data": { ... }, "source": "..." }`
- Error: `{ "requestId": "...", "error": { "code": "...", "message": "..." } }`

---

## Health Check

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

## Vehicle Details (ULIP VAHAN/04)

- **Method:** `POST`
- **Path:** `/ulip/v1/vehicle/details`

### Request Body

```json
{
  "vehicleNumber": "UP32KH0320"
}
```

### Response (200)

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

## Driver Details (ULIP SARATHI/01)

- **Method:** `POST`
- **Path:** `/ulip/v1/driver/details`

### Request Body

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
        },
        {
          "licence_number": "HR51 20210018922",
          "application_number": "2220004221",
          "cov_issue_date": "2021-07-20",
          "cov_office_name": "RLA FARIDABAD (NT)",
          "vehicle_type_abbr": "MCWG",
          "vehicle_type_description": "Motor Cycle with Gear(Non Transport)"
        }
      ]
    },
    "source": "ULIP_SARATHI"
  }
}
```

### Business Rule Errors (400)

Returned when:

- `licence_status` is not active, or
- `valid_to` is missing/expired.

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

## FASTag Details (ULIP FASTAG/01 + FASTAG/02)

- **Method:** `POST`
- **Path:** `/ulip/v1/fastag/details`

### Request Body

```json
{
  "vehicleNumber": "HR38AF9143"
}
```

### Response (200)

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

## E-Challan Details (ULIP ECHALLAN/01)

- **Method:** `POST`
- **Path:** `/ulip/v1/echallan/details`

### Request Body

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

## Common Error Responses

### Validation Error (422)

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

### ULIP Timeout (504)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "ULIP_TIMEOUT",
    "message": "ULIP request timed out"
  }
}
```

### ULIP Unavailable (502) / Circuit Open (503)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "ULIP_UNAVAILABLE",
    "message": "ULIP request failed"
  }
}
```

or

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "error": {
    "code": "CIRCUIT_OPEN",
    "message": "ULIP temporarily unavailable"
  }
}
```