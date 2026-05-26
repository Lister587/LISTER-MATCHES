import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { logger } from "../lib/logger";

const DERIV_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

const ALL_SYMBOLS = [
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
  "BOOM300N", "BOOM500", "BOOM1000",
  "CRASH300N", "CRASH500", "CRASH1000",
  "stpRNG", "RBREUR", "RBREU200",
];

export function createDerivProxy(wss: WebSocketServer): void {
  wss.on("connection", (clientWs: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? "";

    // Route: /api/ws/ticker?symbol=R_10 (single symbol stream)
    if (url.startsWith("/api/ws/ticker")) {
      const qs = new URL(url, "http://localhost").searchParams;
      const symbol = qs.get("symbol");
      if (!symbol || !ALL_SYMBOLS.includes(symbol)) {
        clientWs.close(1008, "Invalid symbol");
        return;
      }
      handleSingleStream(clientWs, symbol);
      return;
    }

    // Route: /api/ws/scanner (all-symbols background scanner stream)
    if (url.startsWith("/api/ws/scanner")) {
      handleScannerStream(clientWs);
      return;
    }

    clientWs.close(1008, "Unknown WS path");
  });
}

function handleSingleStream(clientWs: WebSocket, symbol: string): void {
  logger.info({ symbol }, "Opening single symbol stream");

  const derivWs = new WebSocket(DERIV_WS_URL);
  let closed = false;

  derivWs.on("open", () => {
    derivWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
  });

  derivWs.on("message", (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }
  });

  derivWs.on("error", (err) => {
    logger.error({ err, symbol }, "Deriv single-stream error");
  });

  derivWs.on("close", () => {
    if (!closed) clientWs.close();
  });

  clientWs.on("close", () => {
    closed = true;
    if (derivWs.readyState === WebSocket.OPEN || derivWs.readyState === WebSocket.CONNECTING) {
      derivWs.close();
    }
    logger.info({ symbol }, "Single stream client disconnected");
  });

  clientWs.on("error", (err) => {
    logger.error({ err }, "Single stream client error");
  });
}

interface ScannerMessage {
  type: "tick";
  symbol: string;
  quote: number;
  epoch: number;
}

function handleScannerStream(clientWs: WebSocket): void {
  logger.info("Opening scanner stream for all symbols");

  const derivConnections: WebSocket[] = [];
  let closed = false;

  for (const symbol of ALL_SYMBOLS) {
    const derivWs = new WebSocket(DERIV_WS_URL);

    derivWs.on("open", () => {
      derivWs.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    });

    derivWs.on("message", (data) => {
      if (clientWs.readyState !== WebSocket.OPEN) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.tick) {
          const payload: ScannerMessage = {
            type: "tick",
            symbol: msg.tick.symbol,
            quote: msg.tick.quote,
            epoch: msg.tick.epoch,
          };
          clientWs.send(JSON.stringify(payload));
        }
      } catch {
        // skip malformed messages
      }
    });

    derivWs.on("error", (err) => {
      logger.error({ err, symbol }, "Deriv scanner stream error");
    });

    derivWs.on("close", () => {
      logger.info({ symbol }, "Deriv scanner sub-connection closed");
    });

    derivConnections.push(derivWs);
  }

  clientWs.on("close", () => {
    closed = true;
    logger.info("Scanner stream client disconnected, closing all symbol connections");
    for (const ws of derivConnections) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  });

  clientWs.on("error", (err) => {
    logger.error({ err }, "Scanner stream client error");
    if (!closed) {
      closed = true;
      for (const ws of derivConnections) {
        ws.close();
      }
    }
  });
}
