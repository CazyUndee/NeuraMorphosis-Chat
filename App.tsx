
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessageContent, Sender, StoredChat, ChatMessageHistoryItem, AppView } from './types';
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
} from './services/geminiService';
import * as localStorageService from './services/localStorageService';
import { GenerateContentResponse, Part } from "@google/genai"; 
import { Menu, X, Trash2, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';

const INITIAL_AI_WELCOME_TEXT_IDENTIFIER = "Hello! I'm NeuraMorphosis AI. How can I help you today?";

const createAppInitialWelcomeText = (): string => {
  let text = `${INITIAL_AI_WELCOME_TEXT_IDENTIFIER} You can use **Markdown** for *formatting*! \n\nI am a text-based assistant.`;
  return text;
};

const createNewWelcomeMessage = (): ChatMessageContent => ({
  id: `ai-welcome-${Date.now()}`,
  text: createAppInitialWelcomeText(),
  sender: Sender.AI,
  isStreaming: false,
});

const mapMessagesToGeminiHistory = (messages: ChatMessageContent[], appInitialWelcomeTextForFiltering: string): ChatMessageHistoryItem[] => {
  const history: ChatMessageHistoryItem[] = [];
  for (const msg of messages) {
    if (msg.text.startsWith(INITIAL_AI_WELCOME_TEXT_IDENTIFIER) && msg.sender === Sender.AI && messages.length === 1) {
      // No specific exclusion here, as it's generally fine in history. Landing page visibility is separate.
    }
    
    let textForHistory = msg.text;
    
    if (textForHistory.trim() === "") continue; // Skip empty messages

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

const App: React.FC = () => {
  const [isApiKeyMissing] = useState<boolean>(!process.env.API_KEY);
  const appInitialWelcomeTextRef = useRef(createAppInitialWelcomeText());

  const [messages, setMessages] = useState<ChatMessageContent[]>(() => [createNewWelcomeMessage()]);
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
  
  const [theme, setTheme] = useState<string>(() => localStorageService.loadTheme() || 'default');
  const [customCSS, setCustomCSSState] = useState<string>(() => localStorageService.loadCustomCSS());

  const availableChatModels = useMemo(() => AVAILABLE_CHAT_MODELS, []);

   useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorageService.saveTheme(theme);
  }, [theme]);

  const setAndSaveCustomCSS = (css: string) => {
    setCustomCSSState(css);
    localStorageService.saveCustomCSS(css);
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
        if (activeChat.messages.length > 0 && activeChat.messages[0].sender === Sender.AI && activeChat.messages[0].text.startsWith(INITIAL_AI_WELCOME_TEXT_IDENTIFIER)) {
            appInitialWelcomeTextRef.current = activeChat.messages[0].text;
        } else {
            appInitialWelcomeTextRef.current = createAppInitialWelcomeText();
        }
      }
    } else {
      startNewChat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiKeyMissing]); 

  useEffect(() => {
    if (isApiKeyMissing) return;
    localStorageService.saveChats(allChats);
  }, [allChats, isApiKeyMissing]);

  useEffect(() => {
    if (isApiKeyMissing) return;
    localStorageService.saveActiveChatId(currentChatId);
  }, [currentChatId, isApiKeyMissing]);

  useEffect(() => {
    if (isApiKeyMissing) return;
    if (currentView === 'chat') { 
      const isLandingVisible = messages.length === 1 &&
                              messages[0].sender === Sender.AI &&
                              messages[0].text === appInitialWelcomeTextRef.current &&
                              !isLoading;
      if (!isLandingVisible) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading, appInitialWelcomeTextRef, currentView, isApiKeyMissing]);

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
    if (!hasUserMessage && messagesForContext.length <=1 && messagesForContext[0]?.text === appInitialWelcomeTextRef.current) { 
        if (isNew) {
            setAllChats(prev => prev.map(c => c.id === chatIdForTitle ? { ...c, title: "New Chat" } : c));
        }
        return;
    }

    setIsTitleLoading(true);
    try {
      const newTitle = await generateChatTitleWithAI(messagesForContext, appInitialWelcomeTextRef.current);
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
  }, [currentChatId, appInitialWelcomeTextRef, isApiKeyMissing]);

  const scheduleTitleUpdate = useCallback((chatIdToUpdate: string, isNewChat: boolean = false) => {
    if (isApiKeyMissing) return;
    const chatToUpdate = allChats.find(c => c.id === chatIdToUpdate);
    const messagesForContext = chatToUpdate ? chatToUpdate.messages : (chatIdToUpdate === currentChatId ? messages : []);

    if (messagesForContext.length === 0 && !isNewChat) return; 
    if (messagesForContext.length === 1 && messagesForContext[0].text === appInitialWelcomeTextRef.current && !isNewChat) return;

    titleUpdateQueue.current = { 
        id: chatIdToUpdate, 
        isNew: isNewChat, 
        messagesForContext: [...messagesForContext] 
    };

    if (titleUpdateTimeout.current) {
      clearTimeout(titleUpdateTimeout.current);
    }
    titleUpdateTimeout.current = window.setTimeout(processTitleUpdateQueue, 2000); 
  }, [allChats, currentChatId, messages, processTitleUpdateQueue, appInitialWelcomeTextRef, isApiKeyMissing]);

  const reinitializeChatForCurrentSettings = useCallback(() => {
    if (isApiKeyMissing) return;
    resetChatSession(); 
    const history = mapMessagesToGeminiHistory(messages, appInitialWelcomeTextRef.current);
    console.log("Reinitializing chat session. Model:", currentChatModel, "Thinking Budget:", thinkingBudget, "History entries:", history.length);
    initializeChatSession(currentChatModel, history, thinkingBudget);
  }, [messages, currentChatModel, thinkingBudget, appInitialWelcomeTextRef, isApiKeyMissing]);


  useEffect(() => {
    if (isApiKeyMissing) return;
    if (currentChatId && currentView === 'chat') { 
      console.log("Relevant state changed, reinitializing chat session. Triggered by change in model, budget, or chat ID.");
      reinitializeChatForCurrentSettings();
    }
  }, [currentChatModel, thinkingBudget, currentChatId, reinitializeChatForCurrentSettings, currentView, isApiKeyMissing]);


  const startNewChat = useCallback(() => {
    if (isApiKeyMissing) return;
    resetChatSession();
    const newChatId = `chat-${Date.now()}`;
    appInitialWelcomeTextRef.current = createAppInitialWelcomeText();
    const welcomeMessage = createNewWelcomeMessage(); 
    
    const newChat: StoredChat = {
      id: newChatId,
      title: "New Chat",
      createdAt: new Date().toISOString(),
      messages: [welcomeMessage],
      aiMessagesSinceLastTitleUpdate: 0,
    };
    
    setMessages(newChat.messages); 
    setCurrentChatId(newChatId); 
    setAllChats(prev => [newChat, ...prev.filter(c => c.id !== newChatId)]);
    
    setError(null);
    setIsLoading(false);
    setCurrentView('chat'); 
    setTextToSummarizeForEditor(null); 
    if (isSidebarOpen) setIsSidebarOpen(false);
  }, [isSidebarOpen, isApiKeyMissing]);


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
    
    const updatedMessagesWithUser = [...messages, userMessage];
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
      const currentChat = allChats.find(c => c.id === currentChatId); 
      const userMessagesCount = updatedMessagesWithUser.filter(m => m.sender === Sender.User).length;
      if (currentChat && currentChat.title === "New Chat" && userMessagesCount === 1) {
        scheduleTitleUpdate(currentChatId);
      }
    }

    let fullAiResponseText = "";
    const aiResponseId = `ai-${Date.now()}`;
    let aiMessage: ChatMessageContent = {
      id: aiResponseId,
      text: "",
      sender: Sender.AI,
      isStreaming: true,
    };
    setMessages(prev => [...prev, aiMessage]);

    try {
      const historyForChat = mapMessagesToGeminiHistory(updatedMessagesWithUser, appInitialWelcomeTextRef.current);
      if (messages.length === 1 && messages[0].text === appInitialWelcomeTextRef.current) {
         initializeChatSession(currentChatModel, historyForChat.slice(0, -1), thinkingBudget);
      }

      const stream = await sendMessageToChatStream(inputText);
      for await (const chunk of stream) {
        if (chunk.text) {
          fullAiResponseText += chunk.text;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiResponseId ? { ...msg, text: fullAiResponseText, isStreaming: true } : msg
            )
          );
          scrollToBottom("auto"); 
        }
      }
    } catch (e: any) {
      console.error("Error during chat stream:", e);
      setError(`Error: ${e.message || "Failed to get response from AI."}`);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiResponseId ? { ...msg, text: `Error: ${e.message || "Failed to get response from AI."}`, isError: true, isStreaming: false } : msg
        )
      );
      setIsLoading(false);
      return;
    }
        
    let finalAiMessage = { ...aiMessage, text: fullAiResponseText, isStreaming: false };
    setMessages(prev => prev.map(msg => msg.id === aiResponseId ? finalAiMessage : msg));
    
    if (currentChatId) {
        setAllChats(prevChats =>
            prevChats.map(chat => {
                if (chat.id === currentChatId) {
                    const chatToUpdate = prevChats.find(c => c.id === currentChatId);
                    let baseMessages = chatToUpdate ? chatToUpdate.messages : messages; 
                    baseMessages = baseMessages.filter(m => m.id !== aiResponseId); 
                    const updatedStoredMessages = [...baseMessages, finalAiMessage];
                    
                    const newAiMessageCount = (chat.aiMessagesSinceLastTitleUpdate || 0) + 1;
                    if (newAiMessageCount >= TITLE_UPDATE_MESSAGE_THRESHOLD && chat.title !== "New Chat") {
                        scheduleTitleUpdate(currentChatId);
                    }
                    return { 
                        ...chat, 
                        messages: updatedStoredMessages, 
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
      
      if (chatToLoad.messages.length > 0 && chatToLoad.messages[0].sender === Sender.AI && chatToLoad.messages[0].text.startsWith(INITIAL_AI_WELCOME_TEXT_IDENTIFIER)) {
          appInitialWelcomeTextRef.current = chatToLoad.messages[0].text;
      } else {
          appInitialWelcomeTextRef.current = createAppInitialWelcomeText();
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
    return chat?.title || "NeuraMorphosis Chat";
  }, [currentChatId, allChats, isTitleLoading, isApiKeyMissing]);

  const isEffectivelyNewChat = useMemo(() => {
    if (isApiKeyMissing) return false;
    return messages.length === 1 &&
           messages[0].sender === Sender.AI &&
           messages[0].text === appInitialWelcomeTextRef.current &&
           !isLoading;
  }, [messages, appInitialWelcomeTextRef, isLoading, isApiKeyMissing]);

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
    <div className={`flex h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-hidden`}>
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {currentView !== 'summarizer' && currentView !== 'settings' && (
        <aside className={`absolute md:static top-0 left-0 h-full bg-[var(--surface-1)] text-[var(--text-primary)] w-64 md:w-72 space-y-3 p-4 z-30 transform transition-transform duration-300 ease-in-out shadow-lg
                          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-xl font-semibold">Chat History</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 -mr-1 rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]">
              <X className="w-6 h-6" />
            </button>
          </div>
          <button
            onClick={startNewChat}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-on-primary)] font-semibold py-2.5 px-4 rounded-lg transition-colors duration-150 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)]"
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
                <span className="truncate text-sm">{chat.title}</span>
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
          
          <div className="mt-auto pt-3 border-t border-[var(--border-color-light)]">
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

      <main className={`flex-1 flex flex-col bg-[var(--surface-2)] h-screen w-full ${currentView === 'summarizer' ? 'overflow-y-auto' : ''}`}>
        {currentView === 'chat' && (
          <>
            <header className="bg-[var(--surface-1)] p-3 sm:p-4 shadow-md flex items-center justify-between z-10 h-[60px] flex-shrink-0">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]">
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] truncate ml-2 md:ml-0">
                {currentChatTitle}
              </h2>
              <div className="w-6 h-6 md:hidden"></div>
              <div className="hidden md:block w-0"></div> 
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-br from-[var(--surface-2)] to-[var(--background)]" role="log">
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
                <div className="text-center text-red-400 bg-red-900/30 p-3 rounded-lg shadow-md text-sm" role="alert">
                  <strong>Error:</strong> {error}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="bg-[var(--surface-1)] border-t border-[var(--border-color)] shadow-sm flex-shrink-0">
              <div className="max-w-4xl mx-auto p-3">
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
            availableModels={availableChatModels}
            currentModel={currentChatModel}
            onSetModel={setCurrentChatModel}
            theme={theme}
            onSetTheme={setTheme}
            customCSS={customCSS}
            onSetCustomCSS={setAndSaveCustomCSS}
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
