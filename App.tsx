
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessageContent, Sender, StoredChat, ChatMessageHistoryItem, AppView, ThinkingDetails, BaseTheme, AccentTheme, LanguageOption } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import ChatInput from './components/ChatInput';
import SettingsPage from './components/SettingsPage';
import NewChatLandingPage from './components/NewChatLandingPage';
import SummarizeTextModal from './components/SummarizeTextModal';
import SummarizationEditorPage from './components/SummarizationEditorPage';
import {
  initializeChatSession,
  sendMessageToChatStream,
  resetChatSession,
  generateChatTitleWithAI,
  AVAILABLE_CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  THINKING_CONFIG_SUPPORTED_MODELS,
  getFriendlyModelName,
} from './services/geminiService';
import * as localStorageService from './services/localStorageService';
import { GenerateContentResponse, Part } from "@google/genai";
import { Menu, X, Trash2, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';

const INITIAL_AI_WELCOME_TEXT_BASE = "Hello! I'm NeuraMorphosis AI."; 

const createAppInitialWelcomeText = (modelIdForWelcome: string): string => {
  const friendlyName = getFriendlyModelName(modelIdForWelcome);
  let text = `${INITIAL_AI_WELCOME_TEXT_BASE} You are currently the '${friendlyName}' model. How can I help you today? You can use **Markdown** for *formatting*! \n\nI am a text-based assistant.`;
  return text;
};

const createNewWelcomeMessage = (modelIdForWelcome: string): ChatMessageContent => ({
  id: `ai-welcome-${Date.now()}`,
  text: createAppInitialWelcomeText(modelIdForWelcome),
  sender: Sender.AI,
  isStreaming: false,
});

const mapMessagesToGeminiHistory = (messages: ChatMessageContent[], initialWelcomeTextBaseForFiltering: string): ChatMessageHistoryItem[] => {
  const history: ChatMessageHistoryItem[] = [];
  for (const msg of messages) {
    let textForHistory = msg.text;
    if (textForHistory.trim() === "") continue;

    const currentMessageParts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = [];
    if (textForHistory) {
        currentMessageParts.push({ text: textForHistory });
    }

    if (currentMessageParts.length > 0) {
      history.push({
        role: msg.sender === Sender.User ? 'user' : 'model',
        parts: currentMessageParts,
      });
    }
  }
  return history;
};

const TITLE_UPDATE_MESSAGE_THRESHOLD = 3;

interface ChatContextForTitleUpdate {
  id: string;
  isNew: boolean;
  messagesForContext: ChatMessageContent[];
}

const DEFAULT_TARGET_LANGUAGE = 'none';
const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'none', name: 'None (No Translation)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
];


export const App: React.FC = () => {
  const [isApiKeyMissing] = useState<boolean>(!process.env.API_KEY);
  const appInitialWelcomeTextRef = useRef(createAppInitialWelcomeText(DEFAULT_CHAT_MODEL));

  const [messages, setMessages] = useState<ChatMessageContent[]>(() => [createNewWelcomeMessage(DEFAULT_CHAT_MODEL)]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTitleLoading, setIsTitleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [currentView, setCurrentView] = useState<AppView>('chat');
  const [textToSummarizeForEditor, setTextToSummarizeForEditor] = useState<string | null>(null);

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [allChats, setAllChats] = useState<StoredChat[]>([]);

  const [thinkingBudget, setThinkingBudget] = useState<number>(0);
  const [currentChatModel, setCurrentChatModel] = useState<string>(DEFAULT_CHAT_MODEL);

  const [isSummarizeModalOpen, setIsSummarizeModalOpen] = useState<boolean>(false);

  const [baseTheme, setBaseTheme] = useState<BaseTheme>(() => localStorageService.loadBaseTheme() || 'dark');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(() => localStorageService.loadAccentTheme() || 'default');
  const [customCSS, setCustomCSSState] = useState<string>(() => localStorageService.loadCustomCSS());
  const [targetLanguage, setTargetLanguageState] = useState<string>(() => localStorageService.loadTargetLanguage() || DEFAULT_TARGET_LANGUAGE);


   useEffect(() => {
    document.documentElement.dataset.baseTheme = baseTheme;
    localStorageService.saveBaseTheme(baseTheme);
  }, [baseTheme]);

  useEffect(() => {
    document.documentElement.dataset.accentTheme = accentTheme;
    localStorageService.saveAccentTheme(accentTheme);
  }, [accentTheme]);


  const setAndSaveCustomCSS = (css: string) => {
    setCustomCSSState(css);
    localStorageService.saveCustomCSS(css);
  };

  const setAndSaveTargetLanguage = (langCode: string) => {
    setTargetLanguageState(langCode);
    localStorageService.saveTargetLanguage(langCode);
  };

  useEffect(() => {
    const styleTagId = 'custom-styles-tag';
    let styleTag = document.getElementById(styleTagId) as HTMLStyleElement | null;
    if (!customCSS && styleTag) {
      styleTag.textContent = '';
    } else if (customCSS) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleTagId;
        styleTag.type = 'text/css';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = customCSS;
    }
  }, [customCSS]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isApiKeyMissing) return;
    const loadedChats = localStorageService.loadChats();
    setAllChats(loadedChats);
    const activeId = localStorageService.loadActiveChatId();

    if (activeId && loadedChats.some(chat => chat.id === activeId)) {
      const activeChat = loadedChats.find(chat => chat.id === activeId);
      if (activeChat) {
        setMessages(activeChat.messages);
        setCurrentChatId(activeChat.id);
        if (activeChat.messages.length > 0 && activeChat.messages[0].sender === Sender.AI && activeChat.messages[0].text.startsWith(INITIAL_AI_WELCOME_TEXT_BASE)) {
            appInitialWelcomeTextRef.current = activeChat.messages[0].text;
        } else {
            appInitialWelcomeTextRef.current = createAppInitialWelcomeText(currentChatModel);
        }
      }
    } else {
      startNewChat();
    }
  }, [isApiKeyMissing, currentChatModel]); // Cannot add startNewChat directly due to its own dependencies

  useEffect(() => {
    if (isApiKeyMissing) return;
    localStorageService.saveChats(allChats);
  }, [allChats, isApiKeyMissing]);

  useEffect(() => {
    if (isApiKeyMissing) return;
    localStorageService.saveActiveChatId(currentChatId);
  }, [currentChatId, isApiKeyMissing]);

  const isEffectivelyNewChat = useMemo(() => {
    if (isApiKeyMissing) return false;
    return messages.length === 1 &&
           messages[0].sender === Sender.AI &&
           messages[0].text === appInitialWelcomeTextRef.current &&
           !isLoading;
  }, [messages, appInitialWelcomeTextRef, isLoading, isApiKeyMissing]);

  useEffect(() => {
    if (isApiKeyMissing) return;
    if (currentView === 'chat') {
      if (!isEffectivelyNewChat) { 
        scrollToBottom("auto");
      }
    }
  }, [messages, isLoading, currentView, isApiKeyMissing, isEffectivelyNewChat]);

  const titleUpdateQueue = useRef<ChatContextForTitleUpdate | null>(null);
  const titleUpdateTimeout = useRef<number | null>(null);

  const processTitleUpdateQueue = useCallback(async () => {
    if (isApiKeyMissing || !titleUpdateQueue.current) return;

    const { id: chatIdForTitle, isNew, messagesForContext } = titleUpdateQueue.current;
    titleUpdateQueue.current = null;

    if (chatIdForTitle !== currentChatId && !isNew) {
        console.log("Skipping stale title update for chat ID:", chatIdForTitle);
        return;
    }

    const hasUserMessage = messagesForContext.some(m => m.sender === Sender.User && m.text.trim() !== "");
    if (!hasUserMessage && (messagesForContext.length === 0 || (messagesForContext.length === 1 && messagesForContext[0]?.text.startsWith(INITIAL_AI_WELCOME_TEXT_BASE)))) {
        if (isNew) {
            setAllChats(prev => prev.map(c => c.id === chatIdForTitle ? { ...c, title: "New Chat" } : c));
        }
        return;
    }

    setIsTitleLoading(true);
    try {
      const newTitle = await generateChatTitleWithAI(messagesForContext, INITIAL_AI_WELCOME_TEXT_BASE);
      setAllChats(prevChats =>
        prevChats.map(chat =>
          chat.id === chatIdForTitle ? { ...chat, title: newTitle, aiMessagesSinceLastTitleUpdate: 0 } : chat
        )
      );
    } catch (e) {
      console.error("Failed to update title:", e);
    } finally {
      setIsTitleLoading(false);
    }
  }, [currentChatId, isApiKeyMissing]);

  const scheduleTitleUpdate = useCallback((chatIdToUpdate: string, isNewChat: boolean = false) => {
    if (isApiKeyMissing) return;

    const messagesForContext = chatIdToUpdate === currentChatId
                               ? messages
                               : (allChats.find(c => c.id === chatIdToUpdate)?.messages || []);

    if (messagesForContext.length === 0 && !isNewChat) return;
    
    titleUpdateQueue.current = {
        id: chatIdToUpdate,
        isNew: isNewChat,
        messagesForContext: [...messagesForContext] 
    };

    if (titleUpdateTimeout.current) {
      clearTimeout(titleUpdateTimeout.current);
    }
    titleUpdateTimeout.current = window.setTimeout(processTitleUpdateQueue, 2000);
  }, [allChats, currentChatId, messages, processTitleUpdateQueue, isApiKeyMissing]);

  const reinitializeChatForCurrentSettings = useCallback(() => {
    if (isApiKeyMissing) return;
    resetChatSession();
    const history = mapMessagesToGeminiHistory(messages, INITIAL_AI_WELCOME_TEXT_BASE);
    console.log("Reinitializing chat session. Model:", currentChatModel, "Thinking Budget (UI Value):", thinkingBudget, "History entries:", history.length);
    initializeChatSession(currentChatModel, history, thinkingBudget);
  }, [messages, currentChatModel, thinkingBudget, isApiKeyMissing]);


  useEffect(() => {
    if (isApiKeyMissing) return;
    if (currentChatId && currentView === 'chat' && messages.length > 0) { 
      console.log("Relevant state changed, reinitializing chat session.");
      reinitializeChatForCurrentSettings();
    } else if (currentChatId && currentView === 'chat' && messages.length === 0) {
      resetChatSession(); 
      console.log("Chat is empty, session reset. Will initialize on next message.");
    }
  // Omitting `messages.length` from deps array of this specific useEffect as it was causing re-initialization on every character typed by AI.
  // Re-initialization logic is complex and primarily tied to model/budget changes or loading a new chat.
  // The crucial part `mapMessagesToGeminiHistory(messages, ...)` in reinitializeChatForCurrentSettings *does* use the current messages.
  // If `messages` itself triggers re-init, it can conflict with streaming.
  // This needs careful observation for any regressions. `messages.length` was removed here previously to handle such an issue.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatModel, thinkingBudget, currentChatId, reinitializeChatForCurrentSettings, currentView, isApiKeyMissing]); 


  const startNewChat = useCallback(() => {
    if (isApiKeyMissing) return;
    resetChatSession();
    const newChatId = `chat-${Date.now()}`;
    appInitialWelcomeTextRef.current = createAppInitialWelcomeText(currentChatModel);
    const welcomeMessage = createNewWelcomeMessage(currentChatModel);

    const newChat: StoredChat = {
      id: newChatId,
      title: "New Chat",
      createdAt: new Date().toISOString(),
      messages: [welcomeMessage],
      aiMessagesSinceLastTitleUpdate: 0,
    };

    setMessages([welcomeMessage]);
    setCurrentChatId(newChatId);
    setAllChats(prev => [newChat, ...prev.filter(c => c.id !== newChatId)]);

    setError(null);
    setIsLoading(false);
    setCurrentView('chat');
    setTextToSummarizeForEditor(null);
    if (isSidebarOpen) setIsSidebarOpen(false);
  }, [isSidebarOpen, isApiKeyMissing, currentChatModel]);


  const handleSendMessage = async (inputText: string) => {
    if (isApiKeyMissing || !inputText.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    setCurrentView('chat');

    const userMessage: ChatMessageContent = {
      id: `user-${Date.now()}`,
      text: inputText,
      sender: Sender.User,
    };

    let currentMessagesSnapshot = [...messages];
    let baseMessagesForThisTurn = [...messages];

    if (
      currentMessagesSnapshot.length === 1 &&
      currentMessagesSnapshot[0].sender === Sender.AI &&
      currentMessagesSnapshot[0].text === appInitialWelcomeTextRef.current
    ) {
      baseMessagesForThisTurn = []; 
    }
    const updatedMessagesWithUser = [...baseMessagesForThisTurn, userMessage];
    setMessages(updatedMessagesWithUser);

    if (currentChatId) {
      setAllChats(prevChats =>
        prevChats.map(chat => {
          if (chat.id === currentChatId) {
            return { ...chat, messages: updatedMessagesWithUser };
          }
          return chat;
        })
      );
      const chatForTitleCheck = allChats.find(c => c.id === currentChatId);
      if (chatForTitleCheck && chatForTitleCheck.title === "New Chat" && baseMessagesForThisTurn.length === 0) { 
        scheduleTitleUpdate(currentChatId, true); 
      }
    }

    const aiResponseId = `ai-${Date.now()}`;

    let thinkingDetailsForMessage: ThinkingDetails | undefined = undefined;
    if (THINKING_CONFIG_SUPPORTED_MODELS.includes(currentChatModel)) {
        thinkingDetailsForMessage = {
            enabled: thinkingBudget > 0, // Thinking is enabled if budget is not 0 for supported models.
            budget: thinkingBudget,
            modelUsed: currentChatModel,
            reasoningSupportedByModel: true,
        };
    }

    let aiMessage: ChatMessageContent = {
      id: aiResponseId,
      text: "",
      sender: Sender.AI,
      isStreaming: true,
      thinkingDetails: thinkingDetailsForMessage,
    };
    setMessages(prev => [...prev, aiMessage]);

    let accumulatedRegularText = "";

    try {
      const historyForChatApi = mapMessagesToGeminiHistory(baseMessagesForThisTurn, INITIAL_AI_WELCOME_TEXT_BASE);

      if (baseMessagesForThisTurn.length === 0) {
         console.log("Initializing chat session for the first user message (after welcome removal). API History:", historyForChatApi);
         initializeChatSession(currentChatModel, historyForChatApi, thinkingBudget); 
      } else {
        const currentFullHistory = mapMessagesToGeminiHistory(updatedMessagesWithUser, INITIAL_AI_WELCOME_TEXT_BASE);
        // Pass history *excluding* the latest user message because sendMessageToChatStream will add it.
        // Also exclude the current AI placeholder message.
        const historyForSession = currentFullHistory.slice(0, -1); 
        initializeChatSession(currentChatModel, historyForSession, thinkingBudget); 
        console.log("Ensuring chat session active. Current history length for API (excluding current user and AI placeholder):", historyForSession.length);
      }

      const stream = await sendMessageToChatStream(inputText);
      
      for await (const chunk of stream) {
        const textContent = chunk.text;
        if (textContent) {
          accumulatedRegularText += textContent;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiResponseId ? {
                ...msg,
                text: accumulatedRegularText,
                isStreaming: true,
                thinkingDetails: msg.thinkingDetails,
              } : msg
            )
          );
        }
      }

      // After stream is complete
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiResponseId ? {
            ...msg,
            text: accumulatedRegularText,
            isStreaming: false, 
            thinkingDetails: msg.thinkingDetails,
          } : msg
        )
      );

    } catch (e: any) {
      console.error("Error during chat stream:", e);
      setError(`Error: ${e.message || "Failed to get response from AI."}`);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiResponseId ? {
            ...msg,
            text: `Error: ${e.message || "Failed to get response from AI."}`,
            isError: true,
            isStreaming: false
          } : msg
        )
      );
      setIsLoading(false);
      return;
    }
    
    let finalAiMessage: ChatMessageContent = {
        id: aiResponseId,
        text: accumulatedRegularText,
        sender: Sender.AI,
        isStreaming: false,
        thinkingDetails: thinkingDetailsForMessage,
    };
    
    setMessages(prev => prev.map(msg => msg.id === aiResponseId ? finalAiMessage : msg));

    if (currentChatId) {
        setAllChats(prevChats =>
            prevChats.map(chat => {
                if (chat.id === currentChatId) {
                    const finalMessagesForStorage = [...updatedMessagesWithUser.filter(m => m.id !== aiResponseId), finalAiMessage];
                    const newAiMessageCount = (chat.aiMessagesSinceLastTitleUpdate || 0) + 1;
                    if (newAiMessageCount >= TITLE_UPDATE_MESSAGE_THRESHOLD && chat.title !== "New Chat") {
                        scheduleTitleUpdate(currentChatId);
                    }
                    return {
                        ...chat,
                        messages: finalMessagesForStorage,
                        aiMessagesSinceLastTitleUpdate: newAiMessageCount,
                    };
                }
                return chat;
            })
        );
    }

    setIsLoading(false);
  };


  const switchChat = (chatId: string) => {
    if (isApiKeyMissing) return;
    const chatToLoad = allChats.find(c => c.id === chatId);
    if (chatToLoad) {
      setMessages(chatToLoad.messages);
      setCurrentChatId(chatId);

      if (chatToLoad.messages.length > 0 && chatToLoad.messages[0].sender === Sender.AI && chatToLoad.messages[0].text.startsWith(INITIAL_AI_WELCOME_TEXT_BASE)) {
          appInitialWelcomeTextRef.current = chatToLoad.messages[0].text;
      } else {
          appInitialWelcomeTextRef.current = createAppInitialWelcomeText(currentChatModel);
      }
      setError(null);
      setIsLoading(false);
      setIsSidebarOpen(false);
      setCurrentView('chat');
      setTextToSummarizeForEditor(null);
    }
  };

  const deleteChat = (chatIdToDelete: string) => {
    if (isApiKeyMissing) return;
    const updatedChats = allChats.filter(c => c.id !== chatIdToDelete);
    setAllChats(updatedChats);
    if (currentChatId === chatIdToDelete) {
      if (updatedChats.length > 0) {
        switchChat(updatedChats[0].id);
      } else {
        startNewChat();
      }
    }
  };

  const currentChatTitle = useMemo(() => {
    if (isApiKeyMissing) return "NeuraMorphosis Chat";
    const chat = allChats.find(c => c.id === currentChatId);
    if (isTitleLoading && (!chat || !chat.title || chat.title === "New Chat")) {
        return "Generating title...";
    }
    if (chat && (chat.title === "New Chat" || !chat.title)) {
      if (messages.length === 0 || isEffectivelyNewChat) { 
        return `Chat with ${getFriendlyModelName(currentChatModel)}`;
      }
    }
    return chat?.title || `Chat with ${getFriendlyModelName(currentChatModel)}`;
  }, [currentChatId, allChats, isTitleLoading, isApiKeyMissing, currentChatModel, messages, isEffectivelyNewChat]);


  const openSummarizeModal = () => {
    if (isApiKeyMissing) return;
    setIsSummarizeModalOpen(true);
  }
  const closeSummarizeModal = () => setIsSummarizeModalOpen(false);

  const handleOpenSummarizationEditor = (textToSummarize: string) => {
    if (isApiKeyMissing) return;
    if (!textToSummarize.trim()) {
      setError("Cannot summarize empty text.");
      console.error("Attempted to open summarization editor with empty text.");
      closeSummarizeModal();
      return;
    }
    setTextToSummarizeForEditor(textToSummarize);
    setCurrentView('summarizer');
    closeSummarizeModal();
    if (isSidebarOpen) setIsSidebarOpen(false);
  };

  const handleCloseSummarizationEditor = () => {
    setCurrentView('chat');
    setTextToSummarizeForEditor(null);
  };

  if (isApiKeyMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--background)] text-[var(--text-primary)] p-6 sm:p-8 text-center">
        <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mb-4" />
        <h1 className="text-xl sm:text-2xl font-semibold mb-2 text-[var(--text-primary)]">API Key Not Configured</h1>
        <p className="text-sm sm:text-lg text-[var(--text-secondary)] mb-1">
          The <code>API_KEY</code> environment variable is missing or not accessible.
        </p>
        <p className="text-sm sm:text-md text-[var(--text-secondary)] max-w-md">
          This application requires a valid Google Generative AI API key to function.
          Please ensure it is correctly set up in your deployment environment or local <code>.env</code> file.
        </p>
         <p className="text-xs text-[var(--text-placeholder)] mt-6">
            Refer to the project documentation for setup instructions.
          </p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen text-[var(--text-primary)] overflow-hidden`}>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {currentView !== 'summarizer' && currentView !== 'settings' && (
        <aside className={`absolute md:static top-0 left-0 h-full bg-[var(--surface-1)] text-[var(--text-primary)] w-64 md:w-72 space-y-3 p-4 z-30 transform transition-transform duration-300 ease-in-out
                          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}> 
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-xl font-semibold">Chat History</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 -mr-1 rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]">
              <X className="w-6 h-6" />
            </button>
          </div>
          <button
            onClick={startNewChat}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-primary)] font-semibold py-2.5 px-4 rounded-lg transition-colors duration-150 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)]" 
          >
            + New Chat
          </button>
          <nav className="flex-grow overflow-y-auto space-y-1 pr-1" style={{ scrollbarColor: 'var(--primary) var(--surface-1)', scrollbarWidth: 'thin' }}>
            {allChats.map(chat => (
              <div
                key={chat.id}
                className={`flex items-center justify-between rounded-md cursor-pointer group transition-colors duration-150
                  ${currentChatId === chat.id
                    ? 'bg-[var(--surface-active)] text-[var(--text-on-primary)] border-l-4 border-[var(--primary)] py-2 pr-2 pl-1.5 sm:py-2.5 sm:pr-2.5 sm:pl-1.5'
                    : 'p-2 sm:p-2.5 hover:bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-l-4 border-transparent'
                  }`}
                onClick={() => switchChat(chat.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && switchChat(chat.id)}
                aria-current={currentChatId === chat.id ? "page" : undefined}
              >
                <span className="truncate text-sm">{chat.title === "New Chat" ? `Chat with ${getFriendlyModelName(currentChatModel)}` : chat.title}</span>
                {currentChatId === chat.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                    className="ml-2 p-1 opacity-60 group-hover:opacity-100 hover:text-red-400 focus:text-red-400 rounded-full hover:bg-[var(--surface-active)] focus:outline-none focus:ring-1 focus:ring-red-500"
                    aria-label={`Delete chat: ${chat.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-3">
            <button
              onClick={() => {
                setCurrentView('settings');
                if (isSidebarOpen) setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-start text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] p-2.5 rounded-md transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              aria-label="Open application settings"
            >
              <SettingsIcon className="w-5 h-5 mr-3 text-[var(--primary)]" strokeWidth={1.5} />
              <span>App Settings</span>
            </button>
          </div>

          <div className="text-xs text-center text-[var(--text-placeholder)] pt-2">
            NeuraMorphosis Chat
          </div>
        </aside>
      )}

      <main className={`flex-1 flex flex-col bg-[var(--surface-2)] h-screen w-full ${currentView === 'summarizer' ? 'overflow-y-auto' : 'relative'}`}>
        {currentView === 'chat' && (
          <>
            <header className="bg-[var(--surface-1)] p-3 sm:p-4 flex items-center justify-between z-10 h-[60px] flex-shrink-0"> 
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]">
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] truncate ml-2 md:ml-0">
                {currentChatTitle}
              </h2>
              <div className="w-6 h-6 md:hidden"></div> 
              <div className="hidden md:block w-0"></div> 
            </header>

            <div className="flex-1 overflow-y-auto py-4 bg-gradient-to-br from-[var(--surface-2)] to-[var(--background)] pb-24" role="log">
              <div className="w-[95%] sm:w-4/5 max-w-4xl mx-auto space-y-6">
                {isEffectivelyNewChat ? (
                  <NewChatLandingPage
                      onPromptClick={handleSendMessage}
                      onOpenSummarizeModal={openSummarizeModal}
                  />
                ) : (
                  <>
                    {messages.map((msg) => (
                      <ChatMessageItem key={msg.id} message={msg} />
                    ))}
                  </>
                )}
                {error && !isEffectivelyNewChat && (
                  <div className="text-center text-red-400 bg-red-900/30 p-3 rounded-lg text-sm" role="alert"> 
                    <strong>Error:</strong> {error}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div className={`
              fixed bottom-0 z-20
              pb-4 
              transition-all duration-300 ease-in-out
              ${currentView === 'chat' && isSidebarOpen ? 'left-0' : 'left-0 md:left-72'}
              right-0
              pointer-events-none 
            `}>
              <div className="w-[95%] sm:w-4/5 max-w-4xl mx-auto pointer-events-auto">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </>
        )}
        {currentView === 'settings' && (
          <SettingsPage
            onClose={() => setCurrentView('chat')}
            thinkingBudget={thinkingBudget}
            onSetThinkingBudget={setThinkingBudget}
            availableModels={AVAILABLE_CHAT_MODELS}
            currentModel={currentChatModel}
            onSetModel={setCurrentChatModel}
            baseTheme={baseTheme}
            onSetBaseTheme={setBaseTheme}
            accentTheme={accentTheme}
            onSetAccentTheme={setAccentTheme}
            customCSS={customCSS}
            onSetCustomCSS={setAndSaveCustomCSS}
            targetLanguage={targetLanguage}
            onSetTargetLanguage={setAndSaveTargetLanguage}
            supportedLanguages={SUPPORTED_LANGUAGES}
          />
        )}
        {currentView === 'summarizer' && textToSummarizeForEditor && (
          <SummarizationEditorPage
            originalText={textToSummarizeForEditor}
            onClose={handleCloseSummarizationEditor}
            currentChatModelName={currentChatModel}
          />
        )}
      </main>
      {isSummarizeModalOpen && currentView !== 'summarizer' && (
        <SummarizeTextModal
          isOpen={isSummarizeModalOpen}
          onClose={closeSummarizeModal}
          onSummarizeSubmit={handleOpenSummarizationEditor}
        />
      )}
    </div>
  );
};

export default App;