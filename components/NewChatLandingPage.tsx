
import React from 'react';
import { Lightbulb, Palette, ClipboardList, Brain, TextQuote } from 'lucide-react'; // ImageIcon removed

interface NewChatLandingPageProps {
  onPromptClick: (prompt: string) => void;
  onOpenSummarizeModal: () => void;
}

interface StarterPrompt {
  title: string;
  text: string;
  Icon: React.ElementType;
}

interface ToolDefinition {
  title: string;
  Icon: React.ElementType;
  action?: string; 
  modalTrigger?: () => void;
  disabled?: boolean;
}

const starterPrompts: StarterPrompt[] = [
  {
    title: "Explore Ideas",
    text: "Explain quantum computing in simple terms",
    Icon: Lightbulb,
  },
  { 
    title: "Get Creative", 
    text: "Write a short poem about distant galaxies",
    Icon: Palette,
  },
  { 
    title: "Plan Something", 
    text: "Suggest fun activities for a weekend trip",
    Icon: ClipboardList,
  },
  { 
    title: "Learn Something New", 
    text: "What are the latest breakthroughs in AI ethics?",
    Icon: Brain,
  },
];

const NewChatLandingPage: React.FC<NewChatLandingPageProps> = ({ onPromptClick, onOpenSummarizeModal }) => {
  
  const tools: ToolDefinition[] = [
    // { // "Create an Image" tool removed
    //   title: "Create an Image",
    //   Icon: ImageIcon,
    //   action: "I'd like to create an image.",
    //   disabled: false, 
    // },
    {
      title: "Summarize Text",
      Icon: TextQuote,
      modalTrigger: onOpenSummarizeModal,
      disabled: false, 
    }
  ];

  const StarterPromptCard: React.FC<{ title: string; text: string; Icon: React.ElementType; onClick: () => void; }> = ({ title, text, Icon, onClick }) => (
    <button
      onClick={onClick}
      className={`
        bg-[var(--surface-3)] border border-[var(--border-color)] rounded-xl p-3 sm:p-4 md:p-5 text-left 
        transition-colors w-full shadow-lg 
        hover:bg-[var(--surface-active)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--background)] focus:ring-[var(--ring)]
      `}
      aria-label={`Starter prompt: ${title} - ${text}`}
    >
      <div className="flex items-start">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 mt-0.5 text-[var(--text-accent)] flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h3 className="font-semibold text-sm sm:text-base md:text-lg mb-0.5 sm:mb-1 text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p>
        </div>
      </div>
    </button>
  );

  const ToolPill: React.FC<ToolDefinition & { onPromptClick: (prompt: string) => void }> = 
  ({ title, Icon, action, modalTrigger, disabled = false, onPromptClick }) => (
    <button
      onClick={() => {
        if (disabled) return;
        if (modalTrigger) {
          modalTrigger();
        } else if (action) {
          onPromptClick(action);
        }
      }}
      disabled={disabled}
      className={`
        flex items-center justify-center space-x-1.5 sm:space-x-2
        bg-[var(--surface-3)] border border-[var(--border-color)] rounded-full px-3 py-1.5 sm:px-4 sm:py-2 
        text-xs sm:text-sm font-medium shadow-md
        transition-colors
        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--surface-2)] focus:ring-[var(--ring)]
        ${disabled 
          ? 'opacity-60 cursor-not-allowed bg-[var(--surface-1)] text-[var(--text-placeholder)]' 
          : 'text-[var(--text-primary)] hover:bg-[var(--surface-active)]'
        }
      `}
      aria-label={`Tool: ${title}${disabled ? ' (Coming Soon)' : ''}`}
      aria-disabled={disabled}
    >
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2} aria-hidden="true" />
      <span>{title}</span>
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div 
        className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 animate-fade-in-slow"
        style={{
          background: 'linear-gradient(to right, var(--primary), var(--text-accent), #F0D8FF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        NeuraMorphosis Chat
      </div>
      <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] mb-8 sm:mb-10 md:mb-12 animate-fade-in" style={{animationDelay: '0.3s'}}>
        Hello! How can I help you today?
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full animate-fade-in" style={{animationDelay: '0.6s'}}>
        {starterPrompts.map((prompt, index) => (
          <StarterPromptCard
            key={`starter-${index}`}
            title={prompt.title}
            text={prompt.text}
            Icon={prompt.Icon}
            onClick={() => onPromptClick(prompt.text)}
          />
        ))}
      </div>

      <div className="mt-10 sm:mt-12 md:mt-16 w-full animate-fade-in" style={{animationDelay: '0.9s'}}>
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-[var(--text-primary)] mb-5 sm:mb-6">
          Explore Tools
        </h2>
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 md:gap-4">
          {tools.map((tool, index) => (
            <ToolPill
              key={`tool-${index}`}
              {...tool}
              onPromptClick={onPromptClick}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        @keyframes fade-in-slow {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-slow {
          animation: fade-in-slow 0.7s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default NewChatLandingPage;
