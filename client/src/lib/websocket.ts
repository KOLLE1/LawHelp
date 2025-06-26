import { useEffect, useRef, useState, useCallback } from "react";
import type { WSMessage } from "@/types";

interface UseWebSocketOptions {
  token?: string;
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsAuthenticated(false);
      options.onConnect?.();

      // 🔐 Authenticate immediately if token is provided
      if (options.token) {
        const authPayload: WSMessage = { type: "auth", token: options.token };
        ws.send(JSON.stringify(authPayload));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        if (message.type === "auth_success") {
          setIsAuthenticated(true);
          console.log("✅ WebSocket authenticated");
        }

        if (message.type === "auth_error") {
          setIsAuthenticated(false);
          console.warn("❌ WebSocket authentication failed:", message.message);
          ws.close();
        }

        options.onMessage?.(message);
      } catch (err) {
        console.error("WebSocket JSON parse error:", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsAuthenticated(false);
      options.onDisconnect?.();
    };

    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
      options.onError?.(e);
    };
  }, [options]);

  useEffect(() => {
    if (options.token) {
      connect();
    }

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, options.token]);

  const sendMessage = useCallback((message: WSMessage): boolean => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    if (!isAuthenticated) {
      console.warn("WebSocket is open but not authenticated. Delaying message...");
      // Wait for auth then send
      const waitAndSend = () => {
        if (isAuthenticated) {
          wsRef.current?.send(JSON.stringify(message));
        } else {
          setTimeout(waitAndSend, 100); // retry every 100ms
        }
      };
      waitAndSend();
      return true;
    }

    wsRef.current.send(JSON.stringify(message));
    return true;
  }

  console.warn("WebSocket not ready to send.");
  return false;
}, [isAuthenticated]);


  return {
    isConnected,
    isAuthenticated,
    sendMessage,
  };
}
