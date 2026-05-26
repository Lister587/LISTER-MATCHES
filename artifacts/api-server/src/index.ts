import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { createDerivProxy } from "./ws/deriv-proxy";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const wss = new WebSocketServer({ server, clientTracking: true });

createDerivProxy(wss);

server.listen(port, () => {
  logger.info({ port }, "Server listening with WebSocket support");
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
