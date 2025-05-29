
import { GoogleGenAI, Chat, GenerateContentResponse, Part, Content } from "@google/genai";
import { ChatMessageHistoryItem, ChatMessageContent, Sender } from '../types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY?: string;
    }
  }
}

export const AVAILABLE_CHAT_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  // 'gemini-2.5-pro-preview-05-06', // Removed
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

export const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash-preview-04-17';
export const LEGACY_CHAT_MODEL_FOR_THINKING_CONFIG = 'gemini-2.5-flash-preview-04-17';

// IMAGE_MODEL_NAME and VIDEO_MODEL_NAME removed
const TITLE_GENERATION_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

let ai: GoogleGenAI;
let chatSessionInstance: Chat | null = null;

const initializeAI = () => {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY environment variable not set. Please ensure it is configured.');
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
};

const mapAppMessagesToGeminiHistoryForTitle = (messages: ChatMessageContent[], appInitialWelcomeText: string): ChatMessageHistoryItem[] => {
  return messages
    .filter(msg => {
        if (msg.sender === Sender.User) return true;
        if (msg.sender === Sender.AI &&
            !msg.text.startsWith("AI is viewing the image") && // Kept for legacy, though image generation is removed
            !msg.text.startsWith("NeuraMorphosis AI is thinking deeply...") &&
            msg.text.trim() !== appInitialWelcomeText.trim()
           ) {
            return true;
        }
        return false;
    })
    .map((msg): ChatMessageHistoryItem => ({
      role: msg.sender === Sender.User ? 'user' : 'model',
      parts: [{ text: msg.text }],
  }));
};

const generateFallbackTitle = (chatMessages: ChatMessageContent[]): string => {
  const firstUserMsg = chatMessages.find(msg => msg.sender === Sender.User);
  if (firstUserMsg && firstUserMsg.text) {
      const words = firstUserMsg.text.trim().split(' ');
      return words.slice(0, Math.min(words.length, 4)).join(' ') + (words.length > 4 ? '...' : '');
  }
  return "Chat Conversation";
};

export const generateChatTitleWithAI = async (chatMessages: ChatMessageContent[], appInitialWelcomeText: string): Promise<string> => {
  initializeAI();
  if (!chatMessages || chatMessages.length === 0) {
    return "New Chat";
  }

  const historyForTitle = mapAppMessagesToGeminiHistoryForTitle(chatMessages, appInitialWelcomeText);
  if (historyForTitle.length === 0) {
    console.warn("Title generation: History for title is empty after filtering. Using fallback.");
    return generateFallbackTitle(chatMessages);
  }

  let conversationContext = historyForTitle.map(item => {
    const textFromParts = item.parts.map(p => ('text' in p ? p.text : '')).join('');
    return `${item.role}: ${textFromParts}`;
  }).join('\n');

  if (conversationContext.length > 1500) {
    conversationContext = "..." + conversationContext.substring(conversationContext.length - 1500);
  }
  
  const titlePrompt = `Based on the following conversation snippet, generate a concise and descriptive title (strictly 3-7 words long) that summarizes the main topic or theme. The title should sound like a podcast episode title. Do not include any prefixes like "Title:" or quotation marks around the title. Just provide the title itself.

Conversation:
${conversationContext}

Title:`;

  try {
    const response = await ai.models.generateContent({
      model: TITLE_GENERATION_MODEL_NAME,
      contents: titlePrompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 60,
      },
    });
    
    if (response.promptFeedback?.blockReason) {
      console.warn(`Title generation prompt was blocked. Reason: ${response.promptFeedback.blockReason}. Details:`, response.promptFeedback);
      return generateFallbackTitle(chatMessages);
    }

    const responseText = response.text;

    if (typeof responseText === 'string' && responseText.trim() !== "") {
      let cleanTitle = responseText.trim().replace(/^["']|["']$/g, '');
      if (cleanTitle.toLowerCase().startsWith("title:")) {
        cleanTitle = cleanTitle.substring("title:".length).trim();
      }
      const wordsInTitle = cleanTitle.split(' ');
      if (wordsInTitle.length > 7) {
        cleanTitle = wordsInTitle.slice(0, 7).join(' ') + '...';
      }
      if (!cleanTitle) {
         console.warn("AI returned an effectively empty title after cleaning, using fallback.", { originalResponseText: responseText });
         return generateFallbackTitle(chatMessages);
      }
      return cleanTitle;
    } else {
      console.warn("AI title generation: response.text was empty or not a string. Inspecting further details.", {
        responseTextActual: responseText,
        candidates: response.candidates,
        promptFeedback: response.promptFeedback
      });
      return generateFallbackTitle(chatMessages);
    }
  } catch (error) {
    console.error("Error during AI title generation API call catch block:", error);
    return generateFallbackTitle(chatMessages);
  }
};

export const initializeChatSession = (
  modelName: string,
  history?: ChatMessageHistoryItem[], 
  thinkingBudget?: number
): Chat => {
  initializeAI();

  const chatConfig: { systemInstruction: string; thinkingConfig?: { thinkingBudget: number } } = {
    systemInstruction: `You are NeuraMorphosis AI, a helpful and independent text-based chat assistant.
Provide helpful text-based responses.
If asked about your capabilities, mention you are a text-based assistant.
`,
  };

  if (modelName === LEGACY_CHAT_MODEL_FOR_THINKING_CONFIG) {
    const effectiveThinkingBudget = thinkingBudget !== undefined ? thinkingBudget : 0;
    chatConfig.thinkingConfig = { thinkingBudget: effectiveThinkingBudget };
    console.log(`Chat session initialized with model: ${modelName}, thinking budget: ${effectiveThinkingBudget}`);
  } else {
    console.log(`Chat session initialized with model: ${modelName}. Thinking config not applicable/omitted for this model.`);
  }

  chatSessionInstance = ai.chats.create({
    model: modelName,
    config: chatConfig,
    history: (history as Content[]) || [],
  });
  return chatSessionInstance;
};

export const sendMessageToChatStream = async (
  message: string | Part[]
): Promise<AsyncIterable<GenerateContentResponse>> => {
  if (!chatSessionInstance) {
    console.warn("Chat session not initialized. Attempting to initialize with default model and settings.");
    initializeChatSession(DEFAULT_CHAT_MODEL); 
  }
  if (!chatSessionInstance) {
    throw new Error("Failed to initialize chat session for sending message.");
  }
  const partsForMessage: Part[] = typeof message === 'string' ? [{ text: message }] : message;
  return chatSessionInstance.sendMessageStream({ message: partsForMessage });
};

export const resetChatSession = (): void => {
  chatSessionInstance = null;
};

// generateImageWithImagen function removed
// generateVideoWithVeo function removed
