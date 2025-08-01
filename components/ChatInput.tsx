
import React, { useState, ChangeEvent, FormEvent, KeyboardEvent, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react'; 

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading,
}) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
      const scrollHeight = textareaRef.current.scrollHeight;
      const computedStyle = window.getComputedStyle(textareaRef.current);
      const maxHeightInPx = parseFloat(computedStyle.maxHeight);

      if (scrollHeight > maxHeightInPx) {
        textareaRef.current.style.height = `${maxHeightInPx}px`;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = `${scrollHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [inputText]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
  };

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="
        flex items-end w-full 
        bg-[var(--surface-glass)] rounded-full
        py-2 px-1 sm:px-1.5 
        transition-all duration-150 ease-in-out
        backdrop-blur-lg border border-[var(--border-glass)]
      "
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={inputText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Message NeuraMorphosis..."
        disabled={isLoading}
        className="
          flex-grow bg-transparent text-[var(--text-primary)] 
          border-none focus:border-none rounded-lg 
          py-1.5 pl-1.5 pr-1 
          focus:ring-0 focus:outline-none focus:shadow-none 
          disabled:opacity-60 placeholder-[var(--text-placeholder)] 
          resize-none overflow-y-hidden
          mr-2 
        "
        style={{ minHeight: '2.5rem', maxHeight: '9rem' }} 
        aria-label="Chat message input"
      />
      
      <button
        type="submit"
        disabled={isLoading || !inputText.trim()}
        className="
          bg-[var(--primary)] text-[var(--text-on-primary)] rounded-full 
          hover:bg-[var(--primary-hover)] transition-colors 
          disabled:opacity-60 disabled:cursor-not-allowed 
          flex items-center justify-center 
          w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 
          focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-glass)]
        "
        aria-label={isLoading ? "Sending message" : "Send message"}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-[var(--text-on-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-live="polite">
            <title>Loading</title>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" /> 
        )}
      </button>
    </form>
  );
};

export default ChatInput;