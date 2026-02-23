import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

const envSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  INTERNAL_API_KEY: Joi.string().min(16).required(),

  ULIP_USERNAME: Joi.string().min(1).required(),
  ULIP_PASSWORD: Joi.string().min(1).required(),
  ULIP_BASE_URL: Joi.string().uri().required(),
  ULIP_TIMEOUT_MS: Joi.number().integer().min(100).max(120_000).default(10_000),
  ULIP_RETRY_COUNT: Joi.number().integer().min(0).max(10).default(2),

  // Optional but recommended, ULIP seems to use /user/login for bearer token
  ULIP_LOGIN_URL: Joi.string().uri().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60_000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(60),

  // Circuit breaker (optional advanced)
  ULIP_CIRCUIT_BREAKER_ENABLED: Joi.boolean().default(false),
  ULIP_CIRCUIT_BREAKER_FAILURE_THRESHOLD: Joi.number().integer().min(1).default(5),
  ULIP_CIRCUIT_BREAKER_COOLDOWN_MS: Joi.number().integer().min(1000).default(30_000)
})
  .unknown(true)
  .required();

const { value, error } = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify(
      {
        level: "fatal",
        msg: "Invalid environment variables",
        details: error.details.map((d) => ({
          message: d.message,
          path: d.path
        }))
      },
      null,
      2
    )
  );
  process.exit(1);
}

export const env = {
  PORT: value.PORT as number,
  INTERNAL_API_KEY: value.INTERNAL_API_KEY as string,

  ULIP_USERNAME: value.ULIP_USERNAME as string,
  ULIP_PASSWORD: value.ULIP_PASSWORD as string,
  ULIP_BASE_URL: value.ULIP_BASE_URL as string,
  ULIP_TIMEOUT_MS: value.ULIP_TIMEOUT_MS as number,
  ULIP_RETRY_COUNT: value.ULIP_RETRY_COUNT as number,
  ULIP_LOGIN_URL: value.ULIP_LOGIN_URL as string | undefined,

  RATE_LIMIT_WINDOW_MS: value.RATE_LIMIT_WINDOW_MS as number,
  RATE_LIMIT_MAX: value.RATE_LIMIT_MAX as number,

  ULIP_CIRCUIT_BREAKER_ENABLED: value.ULIP_CIRCUIT_BREAKER_ENABLED as boolean,
  ULIP_CIRCUIT_BREAKER_FAILURE_THRESHOLD:
    value.ULIP_CIRCUIT_BREAKER_FAILURE_THRESHOLD as number,
  ULIP_CIRCUIT_BREAKER_COOLDOWN_MS: value.ULIP_CIRCUIT_BREAKER_COOLDOWN_MS as number
};

