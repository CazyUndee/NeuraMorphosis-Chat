
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessageContent, Sender } from '../types';

interface ChatMessageItemProps {
  message: ChatMessageContent;
}

// Helper to get raw text content from a markdown AST node
const getNodeText = (node: any): string => {
  if (!node) return '';
  if (node.type === 'text') {
    return node.value || '';
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getNodeText).join('');
  }
  return '';
};

// Helper to identify paragraphs that only contain bolded text, to treat them as headers.
const isParagraphWithOnlyBold = (node: any): boolean => {
    if (!node || node.type !== 'paragraph' || !node.children) return false;
    
    // Filter out empty text nodes (e.g., newlines) that the markdown-parser creates
    const significantChildren = node.children.filter((child: any) => 
        child.type === 'text' ? child.value.trim() !== '' : true
    );
    
    if (significantChildren.length === 0) return false;

    // Check if all significant children are 'strong' elements
    return significantChildren.every(child => child.type === 'strong');
};

const markdownComponents = {
  p: ({node, ...props}: any) => {
    const isHeader = isParagraphWithOnlyBold(node);
    const textContent = getNodeText(node).trim();
    if (textContent === '') {
        return null;
    }

    return (
      <div className="w-full">
        <p 
          className={isHeader ? "text-xl font-semibold mt-4 mb-2" : "mb-4"} 
          {...props} 
        />
      </div>
    );
  },
  strong: ({node, ...props}: any) => <strong className="font-semibold" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
  ul: ({node, ...props}: any) => <div className="w-full"><ul className="list-disc list-inside my-2 space-y-1 pl-4" {...props} /></div>,
  ol: ({node, ...props}: any) => <div className="w-full"><ol className="list-decimal list-inside my-2 space-y-1 pl-4" {...props} /></div>,
  li: ({node, ...props}: any) => {
    // Do not render list items that are effectively empty (contain no visible text).
    if (getNodeText(node).trim() === '') {
      return null;
    }
    return <li className="mb-0.5" {...props} />;
  },
  a: ({node, ...props}: any) => <a className="text-[var(--primary)] hover:text-[var(--primary-hover)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
  pre: ({node, ...props}: any) => <div className="w-full"><pre className="bg-[var(--surface-1)] p-3 my-2 rounded-md overflow-x-auto text-base" {...props} /></div>,
  code({ node, inline, className, children, ...props }: any) {
    if (!inline) { // For block code
      return (
        <code className={`${className || ''} text-[var(--text-primary)] block`} {...props}>
          {String(children).replace(/\n$/, '')}
        </code>
      );
    }
    // For inline code
    return <code className="bg-[var(--surface-active)] text-[var(--text-accent)] px-1 py-0.5 rounded text-base" {...props}>{children}</code>;
  },
  h1: ({node, ...props}: any) => <div className="w-full"><h1 className="text-3xl font-bold my-4 text-[var(--text-primary)]" {...props} /></div>,
  h2: ({node, ...props}: any) => <div className="w-full"><h2 className="text-2xl font-bold my-3 text-[var(--text-primary)]" {...props} /></div>,
  h3: ({node, ...props}: any) => <div className="w-full"><h3 className="text-xl font-semibold my-2 text-[var(--text-primary)]" {...props} /></div>,
  h4: ({node, ...props}: any) => <div className="w-full"><h4 className="text-lg font-semibold my-1.5 text-[var(--text-primary)]" {...props} /></div>,
  h5: ({node, ...props}: any) => <div className="w-full"><h5 className="text-base font-bold my-1 text-[var(--text-primary)]" {...props} /></div>,
  h6: ({node, ...props}: any) => <div className="w-full"><h6 className="text-sm font-medium my-1 text-[var(--text-primary)]" {...props} /></div>,
  blockquote: ({node, ...props}: any) => <div className="w-full"><blockquote className="border-l-4 border-[var(--primary)] pl-4 italic my-2 text-[var(--text-secondary)]" {...props} /></div>,
  table: ({node, ...props}: any) => (
    <div className="w-full">
      <div className="overflow-x-auto my-2 bg-[var(--surface-1)] p-2 rounded-md"> 
        <table className="min-w-full border-collapse border border-[var(--border-color)] text-sm text-[var(--text-primary)]" {...props} />
      </div>
    </div>
  ),
  thead: ({node, ...props}: any) => <thead className="bg-[var(--surface-active)]" {...props} />,
  th: ({node, ...props}: any) => <th className="border border-[var(--border-color)] px-3 py-2 text-left bg-[var(--surface-active)] font-semibold text-[var(--text-primary)]" {...props} />,
  td: ({node, ...props}: any) => <td className="border border-[var(--border-color)] px-3 py-2" {...props} />,
};

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  const textToRender = message.text || '';

  if (isUser) {
    const userRowContainerClasses = `flex w-full justify-end`;
    const userBubbleClasses = `bg-[var(--primary)] text-[var(--text-on-primary)] p-3 rounded-[1.5rem] break-words max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl`;
    
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
            {textToRender} 
          </ReactMarkdown>
        </div>
      </div>
    );
  } else { 
    const aiRowContainerClasses = `flex w-full justify-start`;
    const aiContentClasses = `
      w-full
      p-3 break-words text-left 
      ${message.isError ? 'text-red-400' : 'text-[var(--text-primary)]'} 
      bg-[var(--surface-1)] rounded-xl
    `;

    const streamingIndicatorText = "thinking...";
    
    const textForMarkdown = (message.isStreaming && textToRender === '' && !message.isError) ? '\u00A0' : textToRender;

    return (
      <div className={aiRowContainerClasses} role="listitem">
        <div
          className={aiContentClasses.trim().replace(/\s+/g, ' ')} 
          role="log"
          aria-live={message.isStreaming && !message.isError ? "polite" : "off"}
          aria-atomic="true"
        >
          <div className="flex items-baseline flex-wrap">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {textForMarkdown}
            </ReactMarkdown>
            
            {message.isStreaming && !message.isError && <span className="blinking-cursor" style={{flexShrink: 0}}></span>}
          </div>
          
          {!isUser && message.isStreaming && !message.isError && (
             <span className="block mt-1 text-xs text-[var(--text-secondary)] animate-pulse text-left" aria-label={`AI is ${streamingIndicatorText}`}>
                {streamingIndicatorText}
              </span>
           )}
        </div>
      </div>
    );
  }
};

export default ChatMessageItem;
