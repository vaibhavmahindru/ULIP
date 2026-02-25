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
