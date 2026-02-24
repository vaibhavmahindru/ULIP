import { ApiError } from "../utils/errors";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * ULIP commonly returns: { code, message, response: [{ response: <payload> }] }
 * where <payload> can be an object, a JSON string, or (for VAHAN) an XML string.
 *
 * This helper unwraps the payload and throws a consistent error when ULIP indicates failure.
 */
export function unwrapUlipPayload(ulipResponse: unknown): unknown {
  if (!isObject(ulipResponse)) {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_BAD_RESPONSE",
      message: "Unexpected ULIP response"
    });
  }

  const errorFlag = (ulipResponse as any).error;
  if (errorFlag && String(errorFlag).toLowerCase() === "true") {
    throw new ApiError({
      statusCode: 502,
      code: "ULIP_UNAVAILABLE",
      message: "ULIP returned an error"
    });
  }

  const resp = (ulipResponse as any).response;
  if (Array.isArray(resp) && resp.length > 0) {
    const inner = resp[0]?.response;
    if (typeof inner === "string") {
      const trimmed = inner.trim();
      // JSON string payload
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // fall through: return as string if it isn't valid JSON
          return inner;
        }
      }
      return inner;
    }
    return inner;
  }

  // Some ULIP APIs may return the payload at top-level
  if ((ulipResponse as any).data) {
    return (ulipResponse as any).data;
  }

  return ulipResponse;
}

export function pickFirst<T = string>(
  obj: Record<string, unknown>,
  keys: string[]
): T | null {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    return v as T;
  }
  return null;
}

