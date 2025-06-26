import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import type { ChatMessage, WSMessage } from "@/types";
import { useEffect, useRef, useState } from "react";
import { Bot, Mic, Paperclip, Send, Square } from "lucide-react";
import { Message } from "./message";

interface ChatInterfaceProps {
  selectedSessionId?: string;
  onSessionChange?: (sessionId: string) => void;
}

export function ChatInterface({ selectedSessionId, onSessionChange }: ChatInterfaceProps) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localSessionId, setLocalSessionId] = useState<string | undefined>(selectedSessionId);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem("auth_token");

  const { sendMessage, isConnected, isAuthenticated } = useWebSocket({
    token: token || undefined,
    onMessage: (msg: WSMessage) => {
      console.log("WebSocket onMessage received:", msg);
      if (msg.type === "message_sent") {
        // Do not add the message here to avoid duplication; rely on handleSendMessage
        return;
      }
      if (msg.type === "ai_response") {
        const newMessage: ChatMessage = {
          id: getUUID(),
          content: msg.content || "",
          sender: "ai",
          sessionId: msg.sessionId || localSessionId || "default",
          userId: user?.id || "anon",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMessage]);
        setIsTyping(false);
      }

      if (msg.type === "error") {
        toast({
          title: "Error",
          description: typeof msg.message === "string" ? msg.message : "Unknown error",
          variant: "destructive",
        });
        setIsTyping(false);
      }
    },
  });

  const createSession = async (): Promise<string> => {
    console.log("Attempting to create new session with token:", token?.substring(0, 20) + "...");
    try {
      if (!token) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "New Chat Session" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Created new session:", data);
      setLocalSessionId(data.id);
      onSessionChange?.(data.id);
      return data.id;
    } catch (error) {
      console.error("Session creation error:", error);
      toast({
        title: "Session Creation Failed",
        description: `Unable to create a new chat session: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) {
      console.log("No message to send (empty input)");
      return;
    }

    console.log("WebSocket state:", { isConnected, isAuthenticated, sendMessage: !!sendMessage });

    if (!sendMessage || !isConnected || !isAuthenticated) {
      console.log("WebSocket not ready:", { isConnected, isAuthenticated });
      toast({
        title: "WebSocket Not Ready",
        description: "WebSocket is not ready or authenticated",
        variant: "destructive",
      });
      return;
    }

    let sessionId = localSessionId || selectedSessionId;
    if (!sessionId || sessionId === "default") {
      console.log("No valid session ID, creating new session...");
      try {
        sessionId = await createSession();
      } catch (error) {
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: getUUID(),
      content: currentMessage.trim(),
      sender: "user",
      sessionId,
      userId: user?.id || "anon",
      createdAt: new Date().toISOString(),
    };

    // Check if message already exists to avoid duplicates
    if (!messages.some((msg) => msg.id === userMessage.id)) {
      console.log("Adding new user message:", userMessage);
      setMessages((prev) => [...prev, userMessage]);
    } else {
      console.log("Duplicate user message detected, skipping addition:", userMessage);
    }

    setIsTyping(true);

    const payload: WSMessage = {
      type: "user_message",
      sessionId,
      content: currentMessage.trim(),
      userId: user?.id || undefined,
    };

    const sent = sendMessage(payload);
    console.log("Message sent successfully:", sent);

    setCurrentMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 transition-all duration-300">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Bot className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" />
                <p className="text-sm">Start a conversation by typing your legal question below.</p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} mb-4 animate-fade-in`}
              >
                <div
                  className={`max-w-[70%] p-4 rounded-2xl shadow-sm transition-all duration-200 ${
                    message.sender === "user"
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none"
                  }`}
                >
                  <Message message={message} />
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-green-500" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 shadow-lg">
        <div className="max-w-4xl mx-auto p-4">
          <form onSubmit={handleSendMessage} className="relative">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-200 hover:shadow-md">
              <Textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your legal question..."
                className="w-full bg-transparent border-0 resize-none rounded-full px-6 py-3 text-base focus:ring-0 focus:outline-none min-h-[48px] max-h-32"
                rows={1}
              />
              <div className="flex items-center gap-2 pr-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Paperclip className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Mic className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </Button>
                <Button
                  type="submit"
                  disabled={!currentMessage.trim() || isTyping}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex justify-center mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Square className="h-3 w-3" />
                <span>AI Legal Chat</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// UUID fallback for environments where crypto.randomUUID is not available
function getUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 version 4 compliant UUID generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}