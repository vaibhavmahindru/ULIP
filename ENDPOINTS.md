# Internal API Documentation

Authentication: `X-Internal-API-Key` header required for protected endpoints  

---

## Health Check

**Method:** `GET`  
**Path:** `/health`  
**Description:** Simple liveness check.

### Successful Response

```json
{
  "status": "ok"
}
```

---

## Vehicle Details via ULIP VAHAN

**Method:** `POST`  
**Path:** `/ulip/v1/vehicle/details`  

### Headers

```
Content-Type: application/json
X-Internal-API-Key: <your INTERNAL_API_KEY>
```

### Request Body

```json
{
  "vehicleNumber": "MH12AB1234"
}
```

### Successful Response (200)

```json
{
  "requestId": "11111111-2222-3333-4444-555555555555",
  "data": {
    "vehicle": {
      "vehicleNumber": "MH12AB1234",
      "ownerName": "RAHUL SHARMA",
      "address": "101 PARK STREET, MUMBAI",
      "status": "ACTIVE",
      "rcRegistrationDate": "2019-06-15",
      "fitnessCertificateExpiry": "2034-06-14",
      "insuranceExpiry": "2027-06-14",
      "taxExpiry": "2031-06-14",
      "permitExpiry": "2032-01-01",
      "puccExpiry": "2026-06-14",
      "nationalPermitExpiry": "2033-06-14",
      "permitType": "NATIONAL",
      "puccNumber": "PUCC987654",
      "permitNumber": "PERMIT56789",
      "insurer": "ABC INSURANCE LTD",
      "insuranceNumber": "POLICY987654",
      "financier": "XYZ BANK",
      "vehicleClass": "LMV",
      "bodyType": "HATCHBACK",
      "fuelType": "PETROL",
      "chassisNumber": "CHASSIS1234567890",
      "engineNumber": "ENGINE987654321",
      "manufacturer": "SAMPLE MOTORS",
      "model": "SAMPLE MODEL X",
      "normsType": "BS6",
      "vehicleCategory": "NT"
    },
    "source": "ULIP_VAHAN"
  }
}
```

### Validation Error (422)

```json
{
  "requestId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body"
  }
}
```

### Unauthorized (401)

```json
{
  "requestId": "99999999-8888-7777-6666-555555555555",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Unauthorized"
  }
}
```

### ULIP Timeout (504)

```json
{
  "requestId": "12345678-1234-1234-1234-123456789012",
  "error": {
    "code": "ULIP_TIMEOUT",
    "message": "ULIP request timed out"
  }
}
```

### ULIP Unavailable (502/503)

```json
{
  "requestId": "abcdefab-cdef-abcd-efab-cdefabcdefab",
  "error": {
    "code": "ULIP_UNAVAILABLE",
    "message": "ULIP request failed"
  }
}
```

---

## Driver Details via ULIP SARATHI

**Method:** `POST`  
**Path:** `/ulip/v1/driver/details`  

### Headers

```
Content-Type: application/json
X-Internal-API-Key: <your INTERNAL_API_KEY>
```

### Request Body

```json
{
  "dlnumber": "DL0120190001234",
  "dob": "1990-01-15"
}
```

### Successful Response (200)

```json
{
  "requestId": "22222222-3333-4444-5555-666666666666",
  "data": {
    "driver": {
      "dl_number": "DL0120190001234",
      "dob": "1990-01-15",
      "full_name": "ARJUN MEHTA",
      "blood_group": "O+",
      "address_line_1": "45 GREEN AVENUE",
      "address_line_2": "SECTOR 21",
      "gender": "Male",
      "bio_id": "BIO123456789",
      "issued_at": "2019-01-10",
      "valid_from": "2019-01-10",
      "valid_to": "2029-01-09",
      "licence_status": "Active",
      "rto_name": "DELHI RTO (DL)",
      "rto_code": "DL01",
      "categories": [
        {
          "licence_number": "DL0120190001234",
          "application_number": "APP123456",
          "cov_issue_date": "2019-01-10",
          "cov_office_name": "DELHI RTO (DL)",
          "vehicle_type_abbr": "LMV",
          "vehicle_type_description": "LIGHT MOTOR VEHICLE"
        },
        {
          "licence_number": "DL0120190001234",
          "application_number": "APP123456",
          "cov_issue_date": "2019-01-10",
          "cov_office_name": "DELHI RTO (DL)",
          "vehicle_type_abbr": "MCWG",
          "vehicle_type_description": "MOTOR CYCLE WITH GEAR"
        }
      ]
    },
    "source": "ULIP_SARATHI"
  }
}
```

---

## FASTag Details via ULIP FASTAG

**Method:** `POST`  
**Path:** `/ulip/v1/fastag/details`

### Headers

```
Content-Type: application/json
X-Internal-API-Key: <your INTERNAL_API_KEY>
```

### Request Body

```json
{
  "vehicleNumber": "KA01AB4321"
}
```

### Successful Response (200)

```json
{
  "requestId": "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
  "data": {
    "fastag": {
      "vehicleNumber": "KA01AB4321",
      "result": "SUCCESS",
      "respCode": "000",
      "timestamp": "2026-02-25T13:40:32Z",
      "tagDetails": {
        "tagId": "TAG123456789",
        "regNumber": "KA01AB4321",
        "tid": "TID987654321",
        "vehicleClass": "VC14",
        "tagStatus": "ACTIVE",
        "issueDate": "2023-05-30",
        "excCode": "00",
        "bankId": "BANK001",
        "commercialVehicleFlag": "N"
      },
      "vehicle": {
        "errCode": "000",
        "totalTagsInMsg": "1",
        "msgNum": "1",
        "totalTagsInResponse": "1",
        "totalMsg": "1",
        "transactions": [
          {
            "readerReadTime": "2026-02-21T13:22:09Z",
            "seqNo": "SEQ123456789",
            "laneDirection": "N",
            "tollPlazaGeocode": "19.0760,72.8777",
            "tollPlazaName": "MUMBAI EXPRESS TOLL",
            "vehicleType": "VC14",
            "vehicleRegNo": "KA01AB4321"
          }
        ]
      }
    },
    "source": "ULIP_FASTAG"
  }
}
```

---