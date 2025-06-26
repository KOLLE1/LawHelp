import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { createMessage } from "./lib/messages";
import { getAnswerFromAI } from "./routes/chatbot";
import { JWT_SECRET } from "../lib/jwt"; // make sure this exists
import type { IncomingMessage } from "http";

interface WSMessage {
  type: "auth" | "user_message" | "ai_response" | "error" | "auth_success" | "message_sent";
  token?: string;
  sessionId?: string;
  content?: string;
  message?: string;
}

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
}

const authenticatedUsers = new Map<string, WebSocket>();

export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: ExtendedWebSocket, req: IncomingMessage) => {
    console.log("📡 WebSocket connected");

    ws.on("message", async (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());

        if (message.type === "auth" && message.token) {
          const decoded = jwt.verify(message.token, JWT_SECRET) as { userId: string };

          const userId = decoded.userId;
          ws.userId = userId;

          // Store the authenticated socket
          authenticatedUsers.set(userId, ws);
          console.log("✅ Token valid. User ID:", userId);

          ws.send(JSON.stringify({ type: "auth_success", userId }));

          // Setup listener for next messages
          ws.on("message", (msgData) => {
            try {
              const parsed = JSON.parse(msgData.toString()) as WSMessage;
              handleWebSocketMessage(parsed, userId, ws);
            } catch (err) {
              console.error("🔴 Error parsing message:", err);
              ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
            }
          });

          // Handle disconnect
          ws.on("close", () => {
            authenticatedUsers.delete(userId);
            console.log("🔌 WebSocket disconnected (user:", userId, ")");
          });

        } else {
          ws.send(JSON.stringify({ type: "auth_error", message: "Missing or invalid token" }));
          ws.close();
        }
      } catch (err) {
        console.error("❌ Auth failed:", err);
        ws.send(JSON.stringify({ type: "auth_error", message: "Authentication failed" }));
        ws.close();
      }
    });
  });
}

export async function handleWebSocketMessage(
  message: WSMessage,
  userId: string,
  socket: WebSocket
) {
  try {
    if (message.type === "user_message" && message.content && message.sessionId) {
      const { sessionId, content } = message;

      // Save user message
      await createMessage({
        role: "user",
        content,
        userId,
        sessionId,
      });

      // Confirm receipt
      socket.send(JSON.stringify({
        type: "message_sent",
        sessionId,
        content,
      }));

      // Get AI answer
      const aiResponse = await getAnswerFromAI(content);
      const aiText = aiResponse.answer;

      // Save AI response
      await createMessage({
        role: "ai",
        content: aiText,
        userId,
        sessionId,
      });

      // Send to frontend
      socket.send(JSON.stringify({
        type: "ai_response",
        sessionId,
        content: aiText,
      }));
    }
  } catch (err) {
    console.error("❌ WebSocket processing error:", err);
    socket.send(JSON.stringify({
      type: "error",
      message: "Something went wrong on the server.",
    }));
  }
}
