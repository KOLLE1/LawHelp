import express from 'express';
import { OpenAI } from 'openai';

const router = express.Router();

// Groq client holder
let openai: OpenAI | null = null;

// ✅ Call this early in index.ts
export function setGroqClient(apiKey: string) {
  openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

// ✅ Main AI answering function
export async function getAnswerFromAI(content: string): Promise<{ answer: string }> {
  if (!openai) {
    throw new Error("OpenAI client not initialized. Did you forget to call setGroqClient()?");
  }

  // Cameroon Penal Code — this should later be dynamic or fetched from DB
  const penalCodeText = `
    Article 318 — Theft:
    (1) Whoever fraudulently takes another person’s property is guilty of theft and shall be punished with imprisonment for 1 to 5 years.
    (2) If the theft was committed at night or by more than one person, the punishment may be increased.

    Article 319 — Aggravating Circumstances:
    The sentence shall be doubled if the theft was committed with violence.
  `;

  const response = await openai.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [
      {
        role: 'system',
        content: 'You are a legal assistant trained on the Cameroon Penal Code. Answer strictly based on the legal text.',
      },
      {
        role: 'user',
        content: `Cameroon Penal Code:\n\n${penalCodeText}\n\nQuestion: ${content}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  const answer = response.choices?.[0]?.message?.content || 'No answer provided.';
  return { answer };
}

// ✅ Optional HTTP API for debugging via Postman
router.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  try {
    const { answer } = await getAnswerFromAI(question);
    res.json({ answer });
  } catch (err) {
    console.error('❌ Groq API error:', err);
    res.status(500).json({ error: 'AI response failed' });
  }
});

export default router;
