
import { StoredChat, BaseTheme, AccentTheme } from '../types';

const ALL_CHATS_KEY = 'neuramorphosis_allChats';
const ACTIVE_CHAT_ID_KEY = 'neuramorphosis_activeChatId';
const CUSTOM_CSS_KEY = 'neuramorphosis_customCSS';
const BASE_THEME_KEY = 'neuramorphosis_baseTheme';
const ACCENT_THEME_KEY = 'neuramorphosis_accentTheme';
const TARGET_LANGUAGE_KEY = 'neuramorphosis_targetLanguage';


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

export const saveBaseTheme = (theme: BaseTheme): void => {
  try {
    localStorage.setItem(BASE_THEME_KEY, theme);
  } catch (error) {
    console.error("Error saving base theme to localStorage:", error);
  }
};

export const loadBaseTheme = (): BaseTheme | null => {
  try {
    return localStorage.getItem(BASE_THEME_KEY) as BaseTheme | null;
  } catch (error) {
    console.error("Error loading base theme from localStorage:", error);
    return null;
  }
};

export const saveAccentTheme = (theme: AccentTheme): void => {
  try {
    localStorage.setItem(ACCENT_THEME_KEY, theme);
  } catch (error) {
    console.error("Error saving accent theme to localStorage:", error);
  }
};

export const loadAccentTheme = (): AccentTheme | null => {
  try {
    return localStorage.getItem(ACCENT_THEME_KEY) as AccentTheme | null;
  } catch (error) {
    console.error("Error loading accent theme from localStorage:", error);
    return null;
  }
};

export const saveTargetLanguage = (languageCode: string): void => {
  try {
    localStorage.setItem(TARGET_LANGUAGE_KEY, languageCode);
  } catch (error) {
    console.error("Error saving target language to localStorage:", error);
  }
};

export const loadTargetLanguage = (): string | null => {
  try {
    return localStorage.getItem(TARGET_LANGUAGE_KEY);
  } catch (error) {
    console.error("Error loading target language from localStorage:", error);
    return null;
  }
};
