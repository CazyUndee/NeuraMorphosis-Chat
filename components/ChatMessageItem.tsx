
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessageContent, Sender } from '../types';
// Video import removed

interface ChatMessageItemProps {
  message: ChatMessageContent;
}

const markdownComponents = {
  p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal list-inside my-2 ml-4 space-y-1" {...props} />,
  li: ({node, ...props}: any) => <li {...props} />,
  a: ({node, ...props}: any) => <a className="text-[var(--primary)] hover:text-[var(--primary-hover)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
  pre: ({node, ...props}: any) => <pre className="bg-[var(--surface-1)] p-3 my-2 rounded-md overflow-x-auto text-base shadow" {...props} />,
  code({ node, inline, className, children, ...props }: any) {
    if (!inline) { // For block code
      return (
        <code className={`${className || ''} text-[var(--text-primary)] block w-full`} {...props}>
          {String(children).replace(/\n$/, '')}
        </code>
      );
    }
    // For inline code
    return <code className="bg-[var(--surface-active)] text-[var(--text-accent)] px-1 py-0.5 rounded text-base" {...props}>{children}</code>;
  },
  h1: ({node, ...props}: any) => <h1 className="text-3xl font-bold my-4 text-[var(--text-primary)]" {...props} />,
  h2: ({node, ...props}: any) => <h2 className="text-2xl font-bold my-3 text-[var(--text-primary)]" {...props} />,
  h3: ({node, ...props}: any) => <h3 className="text-xl font-semibold my-2 text-[var(--text-primary)]" {...props} />,
  h4: ({node, ...props}: any) => <h4 className="text-lg font-semibold my-1.5 text-[var(--text-primary)]" {...props} />,
  h5: ({node, ...props}: any) => <h5 className="text-base font-bold my-1 text-[var(--text-primary)]" {...props} />,
  h6: ({node, ...props}: any) => <h6 className="text-sm font-medium my-1 text-[var(--text-primary)]" {...props} />,
  blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-[var(--primary)] pl-4 italic my-2 text-[var(--text-secondary)]" {...props} />,
  table: ({node, ...props}: any) => (
    <div className="overflow-x-auto my-2 bg-[var(--surface-1)] p-2 rounded-md shadow">
      <table className="min-w-full border-collapse border border-[var(--border-color)] text-sm text-[var(--text-primary)]" {...props} />
    </div>
  ),
  thead: ({node, ...props}: any) => <thead className="bg-[var(--surface-active)]" {...props} />,
  th: ({node, ...props}: any) => <th className="border border-[var(--border-color)] px-3 py-2 text-left bg-[var(--surface-active)] font-semibold text-[var(--text-primary)]" {...props} />,
  td: ({node, ...props}: any) => <td className="border border-[var(--border-color)] px-3 py-2" {...props} />,
};

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;

  if (isUser) {
    const userRowContainerClasses = `flex w-full justify-end`;
    const userBubbleClasses = `bg-[var(--primary)] text-[var(--text-on-primary)] p-3 rounded-[1.5rem] shadow-md break-words max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl`;
    
    return (
      <div className={userRowContainerClasses} role="listitem">
        <div
          className={userBubbleClasses}
          role="log"
          aria-live="off"
          aria-atomic="true"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      </div>
    );
  } else { // AI message
    const aiRowContainerClasses = `flex w-full justify-center`; 
    const aiBubbleClasses = `
      w-[95%] sm:w-4/5  
      max-w-4xl       
      p-3 break-words text-left
      ${message.isError ? 'text-[#F87171]' : 'text-[var(--text-primary)]'} 
    `;

    const streamingIndicatorText = "typing...";
    
    return (
      <div className={aiRowContainerClasses} role="listitem">
        <div
          className={aiBubbleClasses.trim().replace(/\s+/g, ' ')} 
          role="log"
          aria-live={message.isStreaming && !message.isError ? "polite" : "off"}
          aria-atomic="true"
        >
          {/* Image and Video rendering logic removed */}
          {message.text && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.text || (message.isStreaming && !message.isError ? '\u00A0' : '')}
            </ReactMarkdown>
          )}
          {!isUser && message.isStreaming && !message.isError && message.text && message.text.length > 0 && (
            <span className="block mt-1 text-base text-[var(--text-secondary)] animate-pulse text-left" aria-label={`AI is ${streamingIndicatorText}`}>
              {streamingIndicatorText}
            </span>
          )}
           {!isUser && message.isStreaming && !message.isError && (!message.text || message.text.length === 0) && (
             <span className="block mt-1 text-base text-[var(--text-secondary)] animate-pulse text-left" aria-label={`AI is ${streamingIndicatorText}`}>
                {streamingIndicatorText}
              </span>
           )}
        </div>
      </div>
    );
  }
};

export default ChatMessageItem;