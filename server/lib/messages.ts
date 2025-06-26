import { nanoid } from "nanoid";
import { getDb } from "../db"; // ✅ use the safe accessor
import { chatMessages } from "../../shared/schema"; // ✅ adjust if needed

interface CreateMessageInput {
  role: "user" | "ai";
  content: string;
  sessionId: string;
  userId: string;
}

export async function createMessage({
  role,
  content,
  sessionId,
  userId,
}: CreateMessageInput) {
  const db = getDb(); // ✅ ensure DB is initialized before use

  await db.insert(chatMessages).values({
    id: nanoid(),
    role,
    content,
    sessionId,
    userId,
    createdAt: new Date(),
  });
}
