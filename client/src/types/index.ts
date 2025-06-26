export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  location?: string;
  profileImageUrl?: string;
  isLawyer: boolean;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type ChatSender = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  sender: ChatSender;
  createdAt: string;
  metadata?: {
    category?: string;
    confidence?: number;
    references?: string[];
    disclaimer?: string;
  };
}

export interface Lawyer {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization: string;
  experienceYears: number;
  practiceAreas: string[];
  languages: string[];
  officeAddress?: string;
  description?: string;
  hourlyRate?: number;
  verified: boolean;
  rating: number;
  totalReviews: number;
  user: User;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface WSMessage {
  type:
    | 'auth'
    | 'auth_success'
    | 'auth_error'
    | 'user_message'
    | 'chat_message'
    | 'message_sent'
    | 'ai_response'
    | 'error';
  token?: string;
  sessionId?: string;
  content?: string;
  userId?: string;
  message?: ChatMessage | string;
}
