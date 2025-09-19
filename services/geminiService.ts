import { GenerateContentResponse, Part } from "@google/genai";
import { ChatMessageHistoryItem, ChatMessageContent, Sender } from '../types';

export const AVAILABLE_CHAT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
];

export const MODEL_FRIENDLY_NAMES: Record<string, string> = {
  'gemini-2.5-flash': 'Flash (Fast & Efficient)',
  'gemini-2.5-pro': 'Pro (Advanced & Powerful)',
  'gemini-2.5-flash-lite': 'Flash Lite (Ultra Fast)',
};

export const getFriendlyModelName = (modelId: string): string => MODEL_FRIENDLY_NAMES[modelId] || modelId;

export const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash';

export const THINKING_CONFIG_SUPPORTED_MODELS = [
  'gemini-2.5-flash',
];

const mapAppMessagesToGeminiHistoryForTitle = (messages: ChatMessageContent[], initialWelcomeTextBase: string): ChatMessageHistoryItem[] => {
  return messages
    .filter(msg => {
        if (msg.sender === Sender.User) return true;
        if (msg.sender === Sender.AI &&
            !msg.text.startsWith("AI is viewing the image") && 
            !msg.text.startsWith("NeuraMorphosis AI is thinking deeply...") && 
            !msg.text.startsWith(initialWelcomeTextBase) 
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

export const generateChatTitleWithAI = async (chatMessages: ChatMessageContent[], initialWelcomeTextBase: string): Promise<string> => {
  if (!chatMessages || chatMessages.length === 0) {
    return "New Chat";
  }

  const historyForTitle = mapAppMessagesToGeminiHistoryForTitle(chatMessages, initialWelcomeTextBase);
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
    const apiResponse = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'generate-title',
        payload: { titlePrompt },
      }),
    });
    
    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || `API Error: ${apiResponse.statusText}`);
    }

    const { text: responseText } = await apiResponse.json();

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
      console.warn("AI title generation via proxy returned empty or invalid response.", { responseText });
      return generateFallbackTitle(chatMessages);
    }
  } catch (error) {
    console.error("Error during AI title generation API call catch block:", error);
    return generateFallbackTitle(chatMessages);
  }
};

export const sendMessageToChatStream = async function* (
    message: string | Part[],
    history: ChatMessageHistoryItem[],
    model: string,
    thinkingBudget: number
): AsyncGenerator<GenerateContentResponse> {
    
    const friendlyModelName = getFriendlyModelName(model);
    const chatConfig: { systemInstruction: string; thinkingConfig?: { thinkingBudget: number } } = { 
        systemInstruction: `You are NeuraMorphosis AI, a helpful and independent text-based chat assistant. You are currently operating as the '${friendlyModelName}' model configuration.
Provide helpful text-based responses.
If asked about your capabilities, mention you are a text-based assistant.
Respond in the language of the user's input if it is clear, otherwise default to English.
`,
    };

    if (model === 'gemini-2.5-flash' && thinkingBudget !== undefined) {
        chatConfig.thinkingConfig = { 
          thinkingBudget: thinkingBudget,
        };
    }
    
    const partsForMessage: Part[] = typeof message === 'string' ? [{ text: message }] : message;

    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            type: 'chat',
            payload: {
                history,
                message: { parts: partsForMessage },
                model,
                config: chatConfig,
            }
        }),
    });
    
    if (!response.ok || !response.body) {
        let errorText = `API request failed with status ${response.status}`;
        try {
            const errorJson = await response.json();
            errorText = errorJson.error || errorText;
        } catch (e) {
            // response was not json
        }
        console.error("Proxy chat error:", errorText);
        throw new Error(errorText);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // The original function yields GenerateContentResponse objects.
        // We simulate that here since the client only uses `chunk.text`.
        yield { text: decoder.decode(value) } as GenerateContentResponse;
    }
};
