import { StoredChat } from '../types';

const ALL_CHATS_KEY = 'neuramorphosis_allChats';
const ACTIVE_CHAT_ID_KEY = 'neuramorphosis_activeChatId';
const CUSTOM_CSS_KEY = 'neuramorphosis_customCSS';
const THEME_KEY = 'neuramorphosis_theme';

export const saveChats = (chats: StoredChat[]): void => {
  try {
    localStorage.setItem(ALL_CHATS_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error("Error saving chats to localStorage:", error);
  }
};

export const loadChats = (): StoredChat[] => {
  try {
    const chatsJson = localStorage.getItem(ALL_CHATS_KEY);
    return chatsJson ? JSON.parse(chatsJson) : [];
  } catch (error) {
    console.error("Error loading chats from localStorage:", error);
    return [];
  }
};

export const saveActiveChatId = (id: string | null): void => {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CHAT_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CHAT_ID_KEY);
    }
  } catch (error) {
    console.error("Error saving active chat ID to localStorage:", error);
  }
};

export const loadActiveChatId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_CHAT_ID_KEY);
  } catch (error) {
    console.error("Error loading active chat ID from localStorage:", error);
    return null;
  }
};

export const saveCustomCSS = (css: string): void => {
  try {
    localStorage.setItem(CUSTOM_CSS_KEY, css);
  } catch (error) {
    console.error("Error saving custom CSS to localStorage:", error);
  }
};

export const loadCustomCSS = (): string => {
  try {
    const css = localStorage.getItem(CUSTOM_CSS_KEY);
    return css || "";
  } catch (error) {
    console.error("Error loading custom CSS from localStorage:", error);
    return "";
  }
};

export const saveTheme = (theme: string): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Error saving theme to localStorage:", error);
  }
};

export const loadTheme = (): string | null => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (error) {
    console.error("Error loading theme from localStorage:", error);
    return null;
  }
};