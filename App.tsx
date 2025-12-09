import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessageContent, Sender, StoredChat, ChatMessageHistoryItem, AppView, ThinkingDetails, BaseTheme, AccentTheme, LanguageOption } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import ChatInput from './components/ChatInput';
import SettingsPage from './components/SettingsPage';
import NewChatLandingPage from './components/NewChatLandingPage';
import SummarizeTextModal from './components/SummarizeTextModal';
import SummarizationEditorPage from './components/SummarizationEditorPage';
import {
  sendMessageToChatStream,
  generateChatTitleWithAI,
  AVAILABLE_CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  THINKING_CONFIG_SUPPORTED_MODELS,
  getFriendlyModelName,
} from './services/geminiService';
import * as localStorageService from './services/localStorageService';
import { Part } from "@google/genai";
import { Menu, X, Trash2, Settings as SettingsIcon } from 'lucide-react';

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

const mapMessagesToGeminiHistory = (messages: ChatMessageContent[]): ChatMessageHistoryItem[] => {
  const history: ChatMessageHistoryItem[] = [];
  for (const msg of messages) {
    if (msg.sender === Sender.AI && msg.text.startsWith(INITIAL_AI_WELCOME_TEXT_BASE)) {
        continue;
    }
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
  }, [currentChatModel]); // Cannot add startNewChat directly due to its own dependencies

  useEffect(() => {
    localStorageService.saveChats(allChats);
  }, [allChats]);

  useEffect(() => {
    localStorageService.saveActiveChatId(currentChatId);
  }, [currentChatId]);

  const isEffectivelyNewChat = useMemo(() => {
    return messages.length <= 1 &&
           (!messages[0] || (messages[0].sender === Sender.AI && messages[0].text.startsWith(INITIAL_AI_WELCOME_TEXT_BASE))) &&
           !isLoading;
  }, [messages, isLoading]);

  useEffect(() => {
    if (currentView === 'chat') {
      if (!isEffectivelyNewChat) { 
        scrollToBottom("auto");
      }
    }
  }, [messages, isLoading, currentView, isEffectivelyNewChat]);

  const titleUpdateQueue = useRef<ChatContextForTitleUpdate | null>(null);
  const titleUpdateTimeout = useRef<number | null>(null);

  const processTitleUpdateQueue = useCallback(async () => {
    if (!titleUpdateQueue.current) return;

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
  }, [currentChatId]);

  const scheduleTitleUpdate = useCallback((chatIdToUpdate: string, isNewChat: boolean = false) => {
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
  }, [allChats, currentChatId, messages, processTitleUpdateQueue]);
  
  const startNewChat = useCallback(() => {
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
  }, [isSidebarOpen, currentChatModel]);


  const handleSendMessage = async (inputText: string) => {
    if (!inputText.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    setCurrentView('chat');

    const userMessage: ChatMessageContent = {
      id: `user-${Date.now()}`,
      text: inputText,
      sender: Sender.User,
    };

    let baseMessagesForThisTurn = isEffectivelyNewChat ? [] : [...messages];
    
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
      if (isEffectivelyNewChat) { 
        scheduleTitleUpdate(currentChatId, true); 
      }
    }

    const aiResponseId = `ai-${Date.now()}`;

    let thinkingDetailsForMessage: ThinkingDetails | undefined = undefined;
    if (THINKING_CONFIG_SUPPORTED_MODELS.includes(currentChatModel)) {
        thinkingDetailsForMessage = {
            enabled: thinkingBudget > 0,
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
      const historyForChatApi = mapMessagesToGeminiHistory(updatedMessagesWithUser);

      const stream = await sendMessageToChatStream(
          inputText,
          historyForChatApi.slice(0, -1), // History excluding the current user message
          currentChatModel,
          thinkingBudget
      );
      
      for await (const chunk of stream) {
        const textContent = chunk.text;
        if (textContent) {
          accumulatedRegularText += textContent;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiResponseId ? { ...msg, text: accumulatedRegularText } : msg
            )
          );
        }
      }

    } catch (e: any) {
      console.error("Error during chat stream:", e);
      const errorMessage = `Error: ${e.message || "Failed to get response from AI."}`;
      setError(errorMessage);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiResponseId ? {
            ...msg,
            text: errorMessage,
            isError: true,
            isStreaming: false
          } : msg
        )
      );
      setIsLoading(false);
      return;
    } finally {
        // Final update after stream completes, to turn off streaming indicator
        setMessages(prev =>
            prev.map(msg =>
            msg.id === aiResponseId ? {
                ...msg,
                text: accumulatedRegularText,
                isStreaming: false, 
            } : msg
            )
        );
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
  }, [currentChatId, allChats, isTitleLoading, currentChatModel, messages, isEffectivelyNewChat]);


  const openSummarizeModal = () => {
    setIsSummarizeModalOpen(true);
  }
  const closeSummarizeModal = () => setIsSummarizeModalOpen(false);

  const handleOpenSummarizationEditor = (textToSummarize: string) => {
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
        <aside className={`absolute md:static top-0 left-0 h-full bg-[var(--surface-1)] backdrop-blur-xl border-r border-[var(--border-color)] text-[var(--text-primary)] w-64 md:w-72 space-y-3 p-4 z-30 transform transition-transform duration-300 ease-in-out
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
                    ? 'bg-[var(--surface-active)] text-[var(--text-primary)] border-l-4 border-[var(--primary)] py-2 pr-2 pl-1.5 sm:py-2.5 sm:pr-2.5 sm:pl-1.5'
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

      <main className={`flex-1 flex flex-col bg-transparent h-screen w-full ${currentView === 'summarizer' ? 'overflow-y-auto' : 'relative'}`}>
        {currentView === 'chat' && (
          <>
            <header className="bg-[var(--surface-1)] backdrop-blur-xl border-b border-[var(--border-color)] p-3 sm:p-4 flex items-center justify-between z-10 h-[60px] flex-shrink-0"> 
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]">
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] truncate ml-2 md:ml-0">
                {currentChatTitle}
              </h2>
              <div className="w-6 h-6 md:hidden"></div> 
              <div className="hidden md:block w-0"></div> 
            </header>

            <div className="flex-1 overflow-y-auto py-4 pb-24" role="log">
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
