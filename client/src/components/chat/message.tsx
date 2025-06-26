import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@/types";

interface Props {
  message: ChatMessage & { role: "user" | "ai" };
}

export function Message({ message }: Props) {
  const isAI = message.role === "ai";

  return (
    <div className={`flex gap-3 ${isAI ? "items-start" : "items-end justify-end"}`}>
      {isAI && (
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div className={`rounded-2xl px-4 py-3 text-sm max-w-lg whitespace-pre-wrap ${isAI ? "bg-gray-100 dark:bg-gray-800" : "bg-blue-600 text-white"}`}>
        {message.content}
      </div>

      {!isAI && (
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
