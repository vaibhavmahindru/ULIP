import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming =
    (req.header("x-request-id") ?? req.header("x-correlation-id") ?? undefined) || undefined;
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.id = id;
  res.setHeader("x-request-id", id);
  next();
}

