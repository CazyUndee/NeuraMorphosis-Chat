
import React, { useState, ChangeEvent, FormEvent, KeyboardEvent, useRef, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';

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
    <form onSubmit={handleSubmit} className="flex items-end space-x-3">
      <div className="relative flex-grow">
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message NeuraMorphosis..."
          disabled={isLoading}
          className="w-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-color-light)] rounded-2xl py-2 px-4 focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] focus:outline-none disabled:opacity-60 placeholder-[var(--text-placeholder)] resize-none overflow-y-hidden"
          style={{ minHeight: '2.5rem', maxHeight: '9rem' }}
          aria-label="Chat message input"
        />
      </div>
      
      <button
        type="submit"
        disabled={isLoading || !inputText.trim()}
        className="bg-[var(--primary)] text-[var(--text-on-primary)] rounded-full hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center w-10 h-10 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)]"
        aria-label={isLoading ? "Sending message" : "Send message"}
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-[var(--text-on-primary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-live="polite">
            <title>Loading</title>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <SendHorizontal className="w-5 h-5" />
        )}
      </button>
    </form>
  );
};

export default ChatInput;
    