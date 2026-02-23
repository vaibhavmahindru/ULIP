import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined, // don't include pid/hostname by default
  messageKey: "message",
  formatters: {
    level(label) {
      return { level: label };
    }
  }
});

