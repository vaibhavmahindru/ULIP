import http from "node:http";
import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const HOST = "127.0.0.1"; // bind only to localhost; Nginx terminates TLS

async function main() {
  const app = buildApp();
  const server = http.createServer(app);

  const sockets = new Set<import("node:net").Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  server.listen(env.PORT, HOST, () => {
    logger.info(
      { port: env.PORT, host: HOST, node: process.version },
      "ULIP Gateway Service started"
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutdown initiated");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force close lingering sockets after a grace period
    setTimeout(() => {
      logger.warn({ openSockets: sockets.size }, "Forcing socket close");
      for (const s of sockets) s.destroy();
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});

