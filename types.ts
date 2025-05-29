
export enum Sender {
  User = 'user',
  AI = 'ai',
}

export interface ChatMessageContent {
  id: string;
  text: string;
  sender: Sender;
  isStreaming?: boolean;
  isError?: boolean;
  // Image and video fields removed
}

// For Gemini API chat history
export interface ChatMessageHistoryItem {
  role: 'user' | 'model';
  parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[]; 
}

// For storing chats in localStorage
export interface StoredChat {
  id: string;
  title: string;
  createdAt: string; // ISO string
  messages: ChatMessageContent[];
  aiMessagesSinceLastTitleUpdate?: number; // Counter for dynamic title updates
}

export interface FileUploadError {
  message: string;
  code?: number; // Optional error code, e.g., for size limits
}

export type AppView = 'chat' | 'settings' | 'summarizer';