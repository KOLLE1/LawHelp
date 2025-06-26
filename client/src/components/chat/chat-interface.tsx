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

export function ChatInterface({ selectedSessionId }: ChatInterfaceProps) {
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem("auth_token");

  const { sendMessage, isConnected } = useWebSocket({
    token: token || undefined,
    onMessage: (msg: WSMessage) => {
      if (msg.type === "message_sent" || msg.type === "ai_response") {
        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: msg.content || "",
          sender: msg.type === "message_sent" ? "user" : "ai",
          sessionId: selectedSessionId || "default",
          userId: user?.id || "anon",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMessage]);

        if (msg.type === "ai_response") setIsTyping(false);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    if (!sendMessage || !isConnected) {
      toast({
        title: "WebSocket Not Ready",
        description: "WebSocket is not ready or authenticated",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content: currentMessage.trim(),
      sender: "user",
      sessionId: selectedSessionId || "default",
      userId: user?.id || "anon",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]); // ✅ Correct spread
    setIsTyping(true);

    const payload: WSMessage = {
  type: "user_message", // ✅ Backend expects this
  sessionId: selectedSessionId || "default",
  content: currentMessage.trim(),
  userId: user?.id || undefined,
};


    sendMessage(payload);
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="space-y-6">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {isTyping && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <div className="max-w-3xl mx-auto p-4">
          <form onSubmit={handleSendMessage} className="relative">
            <div className="relative bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <Textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your legal question."
                className="w-full bg-transparent border-0 resize-none rounded-3xl px-6 py-4 pr-20 text-base focus:ring-0 focus:outline-none min-h-[56px] max-h-32"
                rows={1}
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={!currentMessage.trim() || isTyping}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center mt-3 text-xs text-gray-500 dark:text-gray-400">
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
