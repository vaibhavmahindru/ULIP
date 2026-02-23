import express, { type RequestHandler } from "express";
import helmet from "helmet";
import { healthRouter } from "./routes/health";
import { requestIdMiddleware } from "./middleware/requestId";
import { httpLogger } from "./middleware/httpLogger";
import { errorHandler } from "./middleware/errorHandler";
import { ulipRouter } from "./routes/ulip";

export function buildApp() {
  const app = express();

  // Behind Nginx on the same box; use X-Forwarded-* from loopback only
  app.set("trust proxy", "loopback");

  app.use(helmet() as RequestHandler);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "1mb" }) as RequestHandler);

  app.use(requestIdMiddleware as RequestHandler);
  app.use(httpLogger as unknown as RequestHandler);

  app.use(healthRouter);
  app.use(ulipRouter);

  // 404
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Not found" }
    });
  });

  app.use(errorHandler);

  return app;
}

