import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { createMessage } from "./lib/messages";
import { getAnswerFromAI } from "./routes/chatbot";
import { storage } from "./storage-mysql";
import { JWT_SECRET } from "../lib/jwt";
import type { IncomingMessage } from "http";

interface WSMessage {
  type: "auth" | "user_message" | "ai_response" | "error" | "auth_success" | "auth_error" | "message_sent";
  token?: string;
  sessionId?: string;
  content?: string;
  message?: string;
  userId?: string;
}

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
}

const authenticatedUsers = new Map<string, WebSocket>();

export function initWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: ExtendedWebSocket, req: IncomingMessage) => {
    console.log("📡 WebSocket connected");

    const onAuthMessage = async (data: WebSocket.RawData) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        console.log("📨 WebSocket message received:", message);

        if (message.type === "auth" && message.token) {
          const decoded = jwt.verify(message.token, JWT_SECRET) as { userId: string };

          const userId = decoded.userId;
          ws.userId = userId;

          authenticatedUsers.set(userId, ws);
          console.log("✅ Token valid. User ID:", userId);

          ws.send(JSON.stringify({ type: "auth_success", userId }));

          ws.on("message", async (msgData) => {
            try {
              const parsed = JSON.parse(msgData.toString()) as WSMessage;
              console.log("📨 WebSocket message received:", parsed);

              if (parsed.type === "user_message") {
                await handleWebSocketMessage(parsed, userId, ws);
              }
            } catch (err) {
              console.error("🔴 Invalid message format:", err);
              ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
            }
          });

          ws.on("close", () => {
            authenticatedUsers.delete(userId);
            console.log("🔌 WebSocket disconnected (user:", userId, ")");
          });

          ws.off("message", onAuthMessage);
        } else {
          ws.send(JSON.stringify({ type: "auth_error", message: "Missing or invalid token" }));
          ws.close();
        }
      } catch (err) {
        console.error("❌ Auth failed:", err);
        ws.send(JSON.stringify({ type: "auth_error", message: "Authentication failed" }));
        ws.close();
      }
    };

    ws.on("message", onAuthMessage);
  });
}

export async function handleWebSocketMessage(
  message: WSMessage,
  userId: string,
  socket: WebSocket
) {
  console.log("Received WebSocket message:", message);
  try {
    if (message.type === "user_message" && message.content && message.sessionId) {
      console.log("Processing user_message:", { sessionId: message.sessionId, content: message.content });

      // Validate sessionId exists in chat_sessions
      const session = await storage.getChatSession(message.sessionId);
      if (!session) {
        console.error(`Invalid session ID: ${message.sessionId} does not exist in chat_sessions`);
        socket.send(
          JSON.stringify({
            type: "error",
            message: `Session ID ${message.sessionId} does not exist`,
          })
        );
        return;
      }
      if (session.userId !== userId) {
        console.error(`Unauthorized access: User ${userId} does not own session ${message.sessionId}`);
        socket.send(
          JSON.stringify({
            type: "error",
            message: `User not authorized for session ${message.sessionId}`,
          })
        );
        return;
      }

      // Save user message
      await createMessage({
        role: "user",
        content: message.content,
        userId,
        sessionId: message.sessionId,
      });

      // Confirm message sent
      socket.send(
        JSON.stringify({
          type: "message_sent",
          sessionId: message.sessionId,
          content: message.content,
        })
      );

      // Get AI response
      const aiResponse = await getAnswerFromAI(message.content);
      const aiText = aiResponse.answer;

      // Save AI reply
      await createMessage({
        role: "ai",
        content: aiText,
        userId,
        sessionId: message.sessionId,
      });

      // Send to frontend
      socket.send(
        JSON.stringify({
          type: "ai_response",
          sessionId: message.sessionId,
          content: aiText,
        })
      );
    } else {
      console.error("Invalid user_message format:", message);
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format or missing required fields",
        })
      );
    }
  } catch (err: any) {
    console.error("❌ WebSocket processing error:", err);
    socket.send(
      JSON.stringify({
        type: "error",
        message: err.message || "Something went wrong on the server.",
      })
    );
  }
}