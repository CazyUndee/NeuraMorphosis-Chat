
export enum Sender {
  User = 'user',
  AI = 'ai',
}

export interface ThinkingDetails {
  enabled: boolean; // Was thinking (budget > 0 or model default) active?
  budget?: number;   // The thinking budget UI value used
  modelUsed?: string; // The model for which thinking was configured
  reasoningSupportedByModel: boolean; // True if the model supports budget-controlled thinking
  // includeThoughts and actualThoughts removed
}

export interface ChatMessageContent {
  id: string;
  text: string;
  sender: Sender;
  isStreaming?: boolean;
  isError?: boolean;
  thinkingDetails?: ThinkingDetails;
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

export type BaseTheme = 'light' | 'dark';
export type AccentTheme = 'default' | 'blue' | 'green'; // 'default' is purple

export interface LanguageOption {
  code: string; // e.g., 'en', 'es', 'fr', 'none'
  name: string; // e.g., 'English', 'Spanish', 'French', 'None (No Translation)'
}
