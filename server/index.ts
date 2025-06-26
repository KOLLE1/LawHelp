import 'dotenv/config'; // 👈 ensures .env variables are loaded before anything else


import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { initDatabase } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import chatbotRouter, { setGroqClient } from './routes/chatbot';
import { handleWebSocketMessage } from "./ws-handler";
import { initWebSocketServer } from "./ws-handler";

const GROQ_API_KEY = "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"


setGroqClient(GROQ_API_KEY);
console.log(GROQ_API_KEY)

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/chatbot', chatbotRouter);

// ✅ Logging middleware for API responses
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any;

  const originalJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// ✅ WebSocket setup
interface ExtendedWebSocket extends WebSocket {
  userId?: string;
}

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws, req) => {
  const socket = ws as ExtendedWebSocket;
  console.log("📡 WebSocket connected");

  socket.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("📨 WebSocket message received:", message);

      if (message.type === "auth") {
        const token = message.token;

        if (!token) {
          socket.send(JSON.stringify({ type: "auth_error", message: "Missing token" }));
          socket.close();
          return;
        }

        try {
          const JWT_SECRET = process.env.JWT_SECRET! || "ljankfbauifiausfjbdjsjdfjksdbfka"
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          socket.userId = decoded.userId;
          console.log("✅ Token valid. User ID:", socket.userId);
          socket.send(JSON.stringify({ type: "auth_success" }));
        } catch (err) {
          socket.send(JSON.stringify({ type: "auth_error", message: "Invalid token" }));
          socket.close();
        }

        return; // ⛔ You can REMOVE this line or restructure to support continuous handling
      }

      // 🛑 If not authenticated yet, reject all other messages
      if (!socket.userId) {
        socket.send(JSON.stringify({ type: "auth_error", message: "Unauthorized" }));
        socket.close();
        return;
      }

      // ✅ Now handle real messages
      await handleWebSocketMessage(message, socket.userId, socket);

    } catch (err) {
      console.error("WebSocket message error:", err);
      socket.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  });

  socket.on("close", () => {
    console.log("🔌 WebSocket disconnected");
  });
});



// ✅ Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;
});

// ✅ Boot server
(async () => {
  await initDatabase();
  await registerRoutes(app);

  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

    const port = Number(process.env.PORT) || 5000;
    httpServer.listen(port, "0.0.0.0", () => {
      log(`🚀 Server running at http://localhost:${port}`);
    });
})();
