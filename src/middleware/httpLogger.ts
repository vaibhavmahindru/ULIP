import type { Request, Response } from "express";
import pinoHttp from "pino-http";
import { logger } from "../utils/logger";

export const httpLogger = pinoHttp({
  logger,
  customProps(req: Request, res: Response) {
    return {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      remoteIp: req.ip
    };
  },
  serializers: {
    req(req: Request) {
      return {
        id: req.id,
        method: req.method,
        url: req.originalUrl,
        remoteIp: req.ip,
        userAgent: req.headers["user-agent"]
      };
    },
    res(res: Response) {
      return {
        statusCode: res.statusCode
      };
    }
  }
});

