## ULIP Gateway Service

Minimal, secure Node.js/Express service that acts as an internal abstraction layer between your SaaS backend and ULIP APIs.

It runs on an EC2 instance (ap-south-1), binds only to `127.0.0.1`, and is intended to sit behind Nginx. All ULIP-specific logic is contained in a service layer; the SaaS only talks to this gateway over internal REST endpoints.

---

### Features

- **Clean architecture**: separated `controllers`, `services`, `routes`, `middleware`, `utils`, `config`.
- **Security**:
  - Internal API key via `X-Internal-API-Key` header.
  - Helmet security headers.
  - Rate limiting.
  - CORS disabled (no `Access-Control-Allow-*` headers).
  - Server binds to `127.0.0.1` only; Nginx terminates TLS.
- **ULIP client**:
  - Login with ULIP credentials from env vars.
  - Configurable timeout and retry count with exponential backoff.
  - Optional circuit breaker.
  - Structured logging of duration, retries, failures.
- **Observability**:
  - JSON logs (Pino) with `requestId`.
  - Health endpoint at `GET /health`.

---

### Environment variables

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

Key variables:

- **PORT**: internal HTTP port (e.g. `4000`).
- **INTERNAL_API_KEY**: shared secret used by your SaaS backend (header `X-Internal-API-Key`).
- **ULIP_USERNAME / ULIP_PASSWORD**: ULIP credentials.
- **ULIP_BASE_URL**: base ULIP API URL (e.g. `https://www.ulip.dpiit.gov.in/ulip/v1.0.0`).
- **ULIP_LOGIN_URL**: ULIP login URL (e.g. `https://www.ulip.dpiit.gov.in/ulip/v1.0.0/user/login`).
- **ULIP_TIMEOUT_MS / ULIP_RETRY_COUNT**: HTTP timeout and retry attempts.
- **RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX**: rate limiting window and max requests.
- **ULIP_CIRCUIT_BREAKER_***: optional circuit breaker settings.

No credentials are hardcoded in code; everything comes from env vars.

---

### Install & build

```bash
cd ulip-middleLayer
npm install
npm run build
```

Run locally:

```bash
NODE_ENV=development PORT=4000 npm start
```

The service listens on `127.0.0.1:PORT`.

---

### Running with PM2 (production)

On the EC2 instance:

```bash
npm install --global pm2
cd /path/to/ulip-middleLayer
npm install
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save
```

View logs:

```bash
pm2 logs ulip-gateway-service
```

---

### Running with Docker

Build:

```bash
docker build -t ulip-gateway-service .
```

Run (mount `.env` and bind internal port):

```bash
docker run --env-file .env -p 4000:4000 --name ulip-gateway ulip-gateway-service
```

Inside the container the app still binds to `127.0.0.1:4000`.

---

### Nginx configuration (example)

Example Nginx server block to:

- terminate TLS,
- forward to the gateway on localhost,
- only allow the SaaS backend IP `13.62.142.74`.

```nginx
upstream ulip_gateway {
    server 127.0.0.1:4000;
}

server {
    listen 443 ssl http2;
    server_name your-ulip-gateway.example.com;

    ssl_certificate     /etc/letsencrypt/live/your-ulip-gateway.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-ulip-gateway.example.com/privkey.pem;

    # Only allow SaaS backend IP
    allow 13.62.142.74;
    deny all;

    location / {
        proxy_pass http://ulip_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
    }
}
```

Ensure the EC2 instance has an assigned **Elastic IP** that ULIP has whitelisted for outbound calls.

---

### Internal API endpoints

- **Health check**
  - **Method**: `GET`
  - **Path**: `/health`
  - **Description**: Simple liveness check.
  - **Response**:

    ```json
    {
      "status": "ok"
    }
    ```

- **Vehicle details via ULIP VAHAN**
  - **Method**: `POST`
  - **Path**: `/ulip/v1/vehicle/details`
  - **Headers**:
    - `Content-Type: application/json`
    - `X-Internal-API-Key: <your INTERNAL_API_KEY>`
  - **Request body**:

    ```json
    {
      "vehicleNumber": "DL12CX0574"
    }
    ```

  - **Successful response (example)**:

    ```json
    {
      "requestId": "e2c7f2dd-4a1e-4a4d-9a8a-8f6a2351c0a9",
      "data": {
        "vehicle": {
          "vehicleNumber": "DL12CX0574",
          "ownerName": "JOHN DOE",
          "registrationDate": "2018-05-01",
          "registrationValidTill": "2033-05-01",
          "fuelType": "DIESEL",
          "vehicleClass": "LMV",
          "chassisNumber": "XXXXXXXXXXXX1234",
          "engineNumber": "ENG1234567",
          "insuranceValidTill": "2026-05-01",
          "status": "ACTIVE"
        },
        "source": "ULIP_VAHAN"
      }
    }
    ```

  - **Validation error response (HTTP 422)**:

    ```json
    {
      "requestId": "89e9e4c8-0fba-4c71-b56b-21a7a281f0af",
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request body"
      }
    }
    ```

  - **Unauthorized (HTTP 401)**:

    ```json
    {
      "requestId": "d5a9c88a-5f6a-4bfb-8f9d-f7ad4ddc670a",
      "error": {
        "code": "UNAUTHORIZED",
        "message": "Unauthorized"
      }
    }
    ```

  - **ULIP timeout (HTTP 504)**:

    ```json
    {
      "requestId": "1b2a9c5e-31a1-4f8d-bc2b-bc3fd23a3c77",
      "error": {
        "code": "ULIP_TIMEOUT",
        "message": "ULIP request timed out"
      }
    }
    ```

  - **ULIP unavailable / circuit open (HTTP 502/503)**:

    ```json
    {
      "requestId": "c1f7bdb3-408a-4f1b-9448-a43e7f4f0f6c",
      "error": {
        "code": "ULIP_UNAVAILABLE",
        "message": "ULIP request failed"
      }
    }
    ```

---

### Testing locally

1. **Prepare env**:

   ```bash
   cp .env.example .env
   # edit .env with your real ULIP credentials and base URLs
   ```

2. **Run the service**:

   ```bash
   npm install
   npm run build
   npm start
   ```

3. **Call health endpoint**:

   ```bash
   curl http://127.0.0.1:4000/health
   ```

4. **Call vehicle details endpoint** (replace placeholders):

   ```bash
   curl -X POST http://127.0.0.1:4000/ulip/v1/vehicle/details \
     -H "Content-Type: application/json" \
     -H "X-Internal-API-Key: $INTERNAL_API_KEY" \
     -d '{"vehicleNumber":"DL12CX0574"}'
   ```

Logs are output as structured JSON on stdout and include a `requestId` you can use to trace a call end-to-end.

---

### Additional ULIP endpoints

- **Driver details via ULIP SARATHI**
  - **Method**: `POST`
  - **Path**: `/ulip/v1/driver/details`
  - **Headers**:
    - `Content-Type: application/json`
    - `X-Internal-API-Key: <your INTERNAL_API_KEY>`
  - **Request body**:

    ```json
    {
      "dlnumber": "GJ04 20120005008",
      "dob": "1987-05-26"
    }
    ```

  - **Business rules applied**:
    - Licence **must be active** (`licence_status === "Active"` after trimming, case-insensitive).
    - `valid_to` must be present and `valid_to > today`; otherwise the gateway returns HTTP 400 with `code: "BUSINESS_RULE_VIOLATION"`.
  - **Response shape** (no raw ULIP payload; only normalized fields):

    ```json
    {
      "requestId": "...",
      "data": {
        "driver": {
          "dl_number": "HR51 20210018922",
          "dob": "1987-05-26",
          "full_name": "JOHN DOE",
          "blood_group": "B+",
          "address_line_1": "...",
          "address_line_2": "...",
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

- **FASTag details via ULIP FASTAG**
  - **Method**: `POST`
  - **Path**: `/ulip/v1/fastag/details`
  - **Headers**:
    - `Content-Type: application/json`
    - `X-Internal-API-Key: <your INTERNAL_API_KEY>`
  - **Request body**:

    ```json
    {
      "vehicleNumber": "HR38AF9143"
    }
    ```

  - **ULIP calls performed**:
    - `FASTAG/01` for toll plaza **transaction history**.
    - `FASTAG/02` for **static tag/vehicle details** (`vehicledetails[].detail[]`).
  - **Response shape** (aggregated; no raw ULIP envelope):

    ```json
    {
      "requestId": "...",
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

