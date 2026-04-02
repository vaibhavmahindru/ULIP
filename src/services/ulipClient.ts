import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";

interface CircuitState {
  open: boolean;
  failureCount: number;
  openedAt?: number;
}

class UlipRequestError extends ApiError {
  public readonly retryable: boolean;

  constructor(opts: {
    statusCode: number;
    code: ApiError["code"];
    message: string;
    retryable: boolean;
  }) {
    super({
      statusCode: opts.statusCode,
      code: opts.code,
      message: opts.message
    });
    this.retryable = opts.retryable;
  }
}

const circuit: CircuitState = {
  open: false,
  failureCount: 0,
  openedAt: undefined
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let lastAlertAtByKey: Record<string, number> = {};

function buildUlipUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relative = path.replace(/^\/+/, "");
  return new URL(relative, base).toString();
}

function timeoutForPath(path: string): number {
  if (path.startsWith("VAHAN/")) {
    return env.ULIP_TIMEOUT_VAHAN_MS ?? env.ULIP_TIMEOUT_MS;
  }
  if (path.startsWith("SARATHI/")) {
    return env.ULIP_TIMEOUT_SARATHI_MS ?? env.ULIP_TIMEOUT_MS;
  }
  if (path.startsWith("FASTAG/")) {
    return env.ULIP_TIMEOUT_FASTAG_MS ?? env.ULIP_TIMEOUT_MS;
  }
  if (path.startsWith("ECHALLAN/")) {
    return env.ULIP_TIMEOUT_ECHALLAN_MS ?? env.ULIP_TIMEOUT_MS;
  }
  if (path.startsWith("EWAYBILL/")) {
    return env.ULIP_TIMEOUT_EWAYBILL_MS ?? env.ULIP_TIMEOUT_MS;
  }
  return env.ULIP_TIMEOUT_MS;
}

function shouldSendAlert(key: string): boolean {
  const now = Date.now();
  const last = lastAlertAtByKey[key] ?? 0;
  if (now - last < env.ULIP_ALERT_COOLDOWN_MS) {
    return false;
  }
  lastAlertAtByKey[key] = now;
  return true;
}

async function emitUlipAlert(opts: {
  key: string;
  title: string;
  requestId?: string;
  details?: Record<string, unknown>;
}) {
  const { key, title, requestId, details } = opts;
  if (!env.ULIP_ALERT_WEBHOOK_URL || !shouldSendAlert(key)) {
    return;
  }
  try {
    await axios.post(
      env.ULIP_ALERT_WEBHOOK_URL,
      {
        title,
        requestId,
        service: "ulip-gateway-service",
        at: new Date().toISOString(),
        details
      },
      {
        timeout: 5000,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    const axErr = err as AxiosError;
    logger.warn(
      {
        component: "ulipClient",
        requestId,
        key,
        error: { message: axErr.message, code: axErr.code, status: axErr.response?.status }
      },
      "Failed to emit ULIP alert webhook"
    );
  }
}

function isCircuitOpen() {
  if (!env.ULIP_CIRCUIT_BREAKER_ENABLED) {
    return false;
  }
  if (!circuit.open) {
    return false;
  }
  const now = Date.now();
  if (circuit.openedAt && now - circuit.openedAt > env.ULIP_CIRCUIT_BREAKER_COOLDOWN_MS) {
    circuit.open = false;
    circuit.failureCount = 0;
    circuit.openedAt = undefined;
    logger.warn({ component: "ulipClient" }, "Circuit breaker half-open (cooldown elapsed)");
    return false;
  }
  void emitUlipAlert({
    key: "ulip-short-circuit-active",
    title: "ULIP short-circuit active",
    details: {
      openedAt: circuit.openedAt ? new Date(circuit.openedAt).toISOString() : null,
      failureCount: circuit.failureCount
    }
  });
  return true;
}

function recordFailure() {
  if (!env.ULIP_CIRCUIT_BREAKER_ENABLED) {
    return;
  }
  circuit.failureCount += 1;
  if (!circuit.open && circuit.failureCount >= env.ULIP_CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    circuit.open = true;
    circuit.openedAt = Date.now();
    logger.error(
      {
        component: "ulipClient",
        failureCount: circuit.failureCount
      },
      "ULIP circuit breaker opened"
    );
    void emitUlipAlert({
      key: "ulip-circuit-open",
      title: "ULIP circuit breaker opened",
      details: {
        failureCount: circuit.failureCount,
        cooldownMs: env.ULIP_CIRCUIT_BREAKER_COOLDOWN_MS
      }
    });
  }
}

function recordSuccess() {
  circuit.failureCount = 0;
  if (circuit.open) {
    circuit.open = false;
    circuit.openedAt = undefined;
    logger.info({ component: "ulipClient" }, "ULIP circuit breaker closed");
  }
}

async function loginToUlip(requestId?: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const loginUrl = env.ULIP_LOGIN_URL ?? buildUlipUrl(env.ULIP_BASE_URL, "user/login");

  const body = {
    username: env.ULIP_USERNAME,
    password: env.ULIP_PASSWORD
  };

  const start = Date.now();
  try {
    const response = await axios.post(loginUrl, body, {
      timeout: env.ULIP_TIMEOUT_LOGIN_MS,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });

    const durationMs = Date.now() - start;
    logger.info(
      {
        requestId,
        component: "ulipClient",
        operation: "login",
        durationMs,
        statusCode: response.status
      },
      "ULIP login completed"
    );

    const data = response.data as any;

    if (data?.error && String(data.error).toLowerCase() === "true") {
      recordFailure();
      throw new UlipRequestError({
        statusCode: 502,
        code: "ULIP_UNAVAILABLE",
        message: "ULIP login failed",
        retryable: true
      });
    }

    const token =
      data?.response?.id ??
      data?.id ??
      data?.token ??
      data?.access_token ??
      data?.accessToken;

    if (!token || typeof token !== "string") {
      recordFailure();
      throw new UlipRequestError({
        statusCode: 502,
        code: "ULIP_BAD_RESPONSE",
        message: "ULIP login returned unexpected response",
        retryable: false
      });
    }

    cachedToken = token;
    // Conservative TTL of 10 minutes
    tokenExpiresAt = Date.now() + 10 * 60 * 1000;
    recordSuccess();
    return token;
  } catch (err) {
    const durationMs = Date.now() - start;
    const axErr = err as AxiosError;

    logger.error(
      {
        requestId,
        component: "ulipClient",
        operation: "login",
        durationMs,
        error: {
          message: axErr.message,
          code: axErr.code,
          status: axErr.response?.status,
          data: axErr.response?.data
        }
      },
      "ULIP login error"
    );

    recordFailure();

    if (axErr.code === "ECONNABORTED") {
      throw new UlipRequestError({
        statusCode: 504,
        code: "ULIP_TIMEOUT",
        message: "ULIP login timed out",
        retryable: true
      });
    }

    if (axErr.response) {
      const retryable = axErr.response.status === 429 || axErr.response.status >= 500;
      throw new UlipRequestError({
        statusCode: 502,
        code: "ULIP_UNAVAILABLE",
        message: "ULIP login failed",
        retryable
      });
    }

    throw new UlipRequestError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message: "ULIP login failed",
      retryable: true
    });
  }
}

async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  maxRetries: number,
  requestId?: string
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      const retryable = err instanceof UlipRequestError ? err.retryable : false;
      if (!retryable || attempt >= maxRetries) {
        throw err;
      }
      const baseDelayMs = Math.min(1000 * 2 ** attempt, 8000);
      const jitterMs = Math.round(Math.random() * baseDelayMs * 0.3);
      const delayMs = baseDelayMs + jitterMs;
      logger.warn(
        {
          requestId,
          component: "ulipClient",
          attempt,
          baseDelayMs,
          jitterMs,
          delayMs
        },
        "Retrying ULIP call after failure"
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }
}

export interface UlipCallParams<TRequest> {
  path: string; // e.g., 'VAHAN/01'
  body: TRequest;
  requestId?: string;
}

export async function callUlip<TRequest, TResponse>(
  params: UlipCallParams<TRequest>
): Promise<TResponse> {
  const { path, body, requestId } = params;

  if (isCircuitOpen()) {
    throw new ApiError({
      statusCode: 503,
      code: "CIRCUIT_OPEN",
      message: "ULIP temporarily unavailable"
    });
  }

  const token = await loginToUlip(requestId);

  const url = buildUlipUrl(env.ULIP_BASE_URL, path);
  const timeoutMs = timeoutForPath(path);

  return retryWithBackoff<TResponse>(
    async (attempt) => {
      const start = Date.now();
      try {
        const response = await axios.post(url, body, {
          timeout: timeoutMs,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`
          }
        });

        const durationMs = Date.now() - start;
        logger.info(
          {
            requestId,
            component: "ulipClient",
            url,
            path,
            attempt,
            durationMs,
            timeoutMs,
            statusCode: response.status
          },
          "ULIP call completed"
        );

        recordSuccess();
        return response.data as TResponse;
      } catch (err) {
        const durationMs = Date.now() - start;
        const axErr = err as AxiosError;

        logger.error(
          {
            requestId,
            component: "ulipClient",
            url,
            path,
            attempt,
            durationMs,
            timeoutMs,
            error: {
              message: axErr.message,
              code: axErr.code,
              status: axErr.response?.status,
              data: axErr.response?.data
            }
          },
          "ULIP call error"
        );

        if (axErr.code === "ECONNABORTED") {
          recordFailure();
          throw new UlipRequestError({
            statusCode: 504,
            code: "ULIP_TIMEOUT",
            message: "ULIP request timed out",
            retryable: true
          });
        }

        if (axErr.response) {
          const status = axErr.response.status;
          const retryable = status >= 500 || status === 429;
          if (retryable) {
            recordFailure();
          }
          throw new UlipRequestError({
            statusCode: 502,
            code: "ULIP_UNAVAILABLE",
            message: "ULIP request failed",
            retryable
          });
        }

        recordFailure();
        throw new UlipRequestError({
          statusCode: 502,
          code: "ULIP_UNAVAILABLE",
          message: "ULIP request failed",
          retryable: true
        });
      }
    },
    env.ULIP_RETRY_COUNT,
    requestId
  );
}

