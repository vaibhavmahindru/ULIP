import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/errors";

interface CircuitState {
  open: boolean;
  failureCount: number;
  openedAt?: number;
}

const circuit: CircuitState = {
  open: false,
  failureCount: 0,
  openedAt: undefined
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

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

  const loginUrl =
    env.ULIP_LOGIN_URL ??
    `${env.ULIP_BASE_URL.replace(/\/$/, "")}/user/login`.replace(/\/{2,}/g, "/");

  const body = {
    username: env.ULIP_USERNAME,
    password: env.ULIP_PASSWORD
  };

  const start = Date.now();
  try {
    const response = await axios.post(loginUrl, body, {
      timeout: env.ULIP_TIMEOUT_MS,
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
      throw new ApiError({
        statusCode: 502,
        code: "ULIP_UNAVAILABLE",
        message: "ULIP login failed"
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
      throw new ApiError({
        statusCode: 502,
        code: "ULIP_BAD_RESPONSE",
        message: "ULIP login returned unexpected response"
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
      throw new ApiError({
        statusCode: 504,
        code: "ULIP_TIMEOUT",
        message: "ULIP login timed out"
      });
    }

    if (axErr.response) {
      throw new ApiError({
        statusCode: 502,
        code: "ULIP_UNAVAILABLE",
        message: "ULIP login failed"
      });
    }

    throw new ApiError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message: "ULIP login failed"
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
      if (attempt >= maxRetries) {
        throw err;
      }
      const delayMs = Math.min(1000 * 2 ** attempt, 8000);
      logger.warn(
        {
          requestId,
          component: "ulipClient",
          attempt,
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

  const url = `${env.ULIP_BASE_URL.replace(/\/$/, "")}/${path}`.replace(/\/{2,}/g, "/");

  return retryWithBackoff<TResponse>(
    async (attempt) => {
      const start = Date.now();
      try {
        const response = await axios.post(url, body, {
          timeout: env.ULIP_TIMEOUT_MS,
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
            attempt,
            durationMs,
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
            attempt,
            durationMs,
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
          throw new ApiError({
            statusCode: 504,
            code: "ULIP_TIMEOUT",
            message: "ULIP request timed out"
          });
        }

        if (axErr.response) {
          const status = axErr.response.status;
          if (status >= 500 || status === 429) {
            recordFailure();
          }
          throw new ApiError({
            statusCode: 502,
            code: "ULIP_UNAVAILABLE",
            message: "ULIP request failed"
          });
        }

        recordFailure();
        throw new ApiError({
          statusCode: 502,
          code: "ULIP_UNAVAILABLE",
          message: "ULIP request failed"
        });
      }
    },
    env.ULIP_RETRY_COUNT,
    requestId
  );
}

