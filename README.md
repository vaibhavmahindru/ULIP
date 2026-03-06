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
  - CORS enabled (`origin: *`) in app code. Restrict access at Nginx/security-group/WAF layer.
  - Server binds to `127.0.0.1` only; Nginx terminates TLS.
- **ULIP client**:
  - Login with ULIP credentials from env vars.
  - Retry only for transient failures (`timeout`, network errors, `429`, `5xx`).
  - Exponential backoff with jitter to prevent retry storms.
  - Per-endpoint timeout overrides (VAHAN/SARATHI/FASTAG/ECHALLAN/login).
  - Optional circuit breaker short-circuit when ULIP repeatedly fails.
  - Optional alert webhook when circuit opens / short-circuit is active.
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
- **ULIP_TIMEOUT_LOGIN_MS**: login timeout override.
- **ULIP_TIMEOUT_VAHAN_MS / ULIP_TIMEOUT_SARATHI_MS / ULIP_TIMEOUT_FASTAG_MS / ULIP_TIMEOUT_ECHALLAN_MS**: endpoint timeout overrides.
- **RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX**: rate limiting window and max requests.
- **ULIP_CIRCUIT_BREAKER_***: optional circuit breaker settings.
- **ULIP_ALERT_WEBHOOK_URL / ULIP_ALERT_COOLDOWN_MS**: optional outbound alerts when ULIP repeatedly fails.

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

For defense-in-depth, apply the IP allowlist at:
- EC2 security group ingress
- Nginx `allow` / `deny`
- (optional) AWS WAF IP set

---

### Fastest AWS deployment (simple + efficient)

Use this path if you want minimal moving parts and quick production rollout.

1. **Launch EC2 in Mumbai (`ap-south-1`)**
   - Ubuntu 22.04 LTS, t3.small/t3.medium.
   - Attach an **Elastic IP** (this is the outbound IP ULIP whitelists).
2. **Network hardening**
   - Security group:
     - `22` from your admin IP only
     - `443` only from trusted caller IP ranges (or temporarily `0.0.0.0/0` during testing)
     - block direct app port from internet
3. **Install runtime**
   - Node 20 LTS, Nginx, PM2.
4. **Deploy app**
   - Pull repo, `npm ci`, `npm run build`.
   - Set production env in `.env` (or preferably SSM/Secrets Manager template pull).
   - Start with PM2 using `ecosystem.config.cjs`.
5. **Nginx reverse proxy**
   - TLS termination + proxy to `127.0.0.1:<PORT>`.
   - Keep `allow/deny` rules for caller IPs.
6. **ULIP whitelisting**
   - Share EC2 Elastic IP with ULIP and confirm connectivity.
7. **Monitoring**
   - Configure CloudWatch Agent for logs and EC2 metrics alarms.

This architecture is the easiest to operate for initial production traffic. Move to ECS/ALB later if you need autoscaling and blue/green deployments.

---

### Incident runbooks

#### 1) ULIP outage handling

1. Verify `/health` is up and app is serving.
2. Check logs for spikes in `ULIP_TIMEOUT`, `ULIP_UNAVAILABLE`, retries, and circuit-open events.
3. Confirm if ULIP failures are `429/5xx` (upstream) or connection/DNS/TLS issues.
4. If circuit breaker is opening repeatedly:
   - Temporarily reduce inbound rate at Nginx/WAF.
   - Increase endpoint timeout only if ULIP is slow (not failing).
   - Notify downstream consumers of degraded mode.
5. If persistent, raise to ULIP support with request IDs and timestamps.
6. After recovery, verify success/error ratio normalizes before removing traffic controls.

#### 2) API key rotation

1. Generate a new random internal key.
2. Update downstream clients to support dual-key period.
3. Deploy app with new key (`INTERNAL_API_KEY`) during maintenance window.
4. Validate traffic with new key.
5. Revoke old key and confirm no requests using it remain.

#### 3) Rollback procedure

1. Keep at least one known-good release artifact/tag.
2. If release fails:
   - `pm2 stop` current app
   - deploy last known-good code/env
   - `npm ci && npm run build && pm2 start ecosystem.config.cjs`
3. Verify `/health` and smoke-test all ULIP routes.
4. Review diffs/logs before reattempting deployment.

#### 4) ULIP whitelist IP change

1. Allocate new Elastic IP in `ap-south-1`.
2. Attach to EC2 (or update NAT EIP for private architecture).
3. Share new IP with ULIP team and wait for confirmation.
4. During cutover, run synthetic checks against each ULIP route.
5. Keep old IP attached until new IP is confirmed active.

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
