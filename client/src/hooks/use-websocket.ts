import { useEffect, useRef, useState } from "react";
import type { WSMessage } from "@/types";

export interface UseWebSocketOptions {
  token?: string;
  onMessage: (msg: WSMessage) => void;
}

export function useWebSocket({ token, onMessage }: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/ws`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      if (token) {
        const authMessage: WSMessage = {
          type: "auth",
          token,
        };
        socket.send(JSON.stringify(authMessage));
      }
    };

    socket.onmessage = (event) => {
      try {
        const parsed: WSMessage = JSON.parse(event.data);

        if (parsed.type === "auth_success") {
          setIsAuthenticated(true);
        } else if (parsed.type === "auth_error") {
          console.error("WebSocket auth failed:", parsed.message);
          setIsAuthenticated(false);
        }

        onMessage(parsed);
      } catch (error) {
        console.error("Invalid WebSocket message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      setIsConnected(false);
      setIsAuthenticated(false);
      console.warn("WebSocket disconnected");
    };

    return () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  }, [token]);

  const sendMessage = (msg: WSMessage): boolean => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      isAuthenticated
    ) {
      socketRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  return {
    sendMessage,
    isConnected,
    isAuthenticated,
  };
}