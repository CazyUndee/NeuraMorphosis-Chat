
import React, { useState } from 'react';
import { LEGACY_CHAT_MODEL_FOR_THINKING_CONFIG } from '../services/geminiService';
import { X, Brain, SlidersHorizontal as BudgetIcon, ArrowLeft, Palette, Settings2 } from 'lucide-react'; // Sparkles, Film, ImageIcon removed

interface SettingsPageProps {
  onClose: () => void;
  thinkingBudget: number; 
  onSetThinkingBudget: (budget: number) => void; 
  availableModels: string[];
  currentModel: string;
  onSetModel: (modelName: string) => void;
  // Image and video generation props removed
  theme: string;
  onSetTheme: (theme: string) => void;
  customCSS: string;
  onSetCustomCSS: (css: string) => void;
}

type SettingsCategory = 'ai' | 'appearance'; // 'features' removed

const SettingsPage: React.FC<SettingsPageProps> = ({
  onClose,
  thinkingBudget,
  onSetThinkingBudget,
  availableModels,
  currentModel,
  onSetModel,
  // Image and video generation props destructured here are removed
  theme,
  onSetTheme,
  customCSS,
  onSetCustomCSS,
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('ai');

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value)) value = 0;
    value = Math.max(0, Math.min(5, value));
    onSetThinkingBudget(value);
  };

  const isChatModelEffectivelyAvailable = currentModel && availableModels.includes(currentModel);
  const isThinkingBudgetApplicable = currentModel === LEGACY_CHAT_MODEL_FOR_THINKING_CONFIG && isChatModelEffectivelyAvailable;

  const themeOptions = [
    { label: 'Default (Purple)', value: 'default' },
    { label: 'Ocean Blue', value: 'blue' },
    { label: 'Forest Green', value: 'green' },
  ];

  const categoryConfig: { id: SettingsCategory; label: string; Icon: React.ElementType }[] = [
    { id: 'ai', label: 'AI Config', Icon: Brain },
    // { id: 'features', label: 'Features', Icon: Sparkles }, // Features category removed
    { id: 'appearance', label: 'Appearance', Icon: Palette },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-[var(--text-primary)]">
      <header className="bg-[var(--surface-1)] p-3 sm:p-4 shadow-md flex items-center justify-between z-10 h-[60px] flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] flex items-center"
          aria-label="Back to chat"
        >
          <ArrowLeft className="w-5 h-5 sm:mr-2" />
          <span className="hidden sm:inline text-sm">Back to Chat</span>
        </button>
        <h2 id="settings-page-title" className="text-base sm:text-lg md:text-xl font-semibold text-[var(--text-primary)]">
          Application Settings
        </h2>
        <div className="w-10 sm:w-32 md:w-40"> {/* Spacer */} </div>
      </header>

      <nav className="bg-[var(--surface-1)] border-b border-[var(--border-color)] shadow-sm">
        <div className="max-w-5xl mx-auto px-1 sm:px-2 md:px-4 lg:px-6">
          <div className="flex justify-around sm:justify-center sm:space-x-1 md:space-x-2">
            {categoryConfig.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center px-1.5 py-2.5 sm:px-2 sm:py-3 md:px-3 md:py-3.5 text-[11px] xs:text-xs sm:text-sm font-medium rounded-t-md transition-colors
                  ${activeCategory === cat.id 
                    ? 'border-b-2 border-[var(--primary)] text-[var(--primary)] bg-[var(--surface-2)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                  }
                  focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:z-10
                `}
                aria-current={activeCategory === cat.id ? 'page' : undefined}
              >
                <cat.Icon className="w-3.5 h-3.5 mr-1 sm:mr-1.5 md:mr-2" strokeWidth={activeCategory === cat.id ? 2 : 1.5} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div 
        className="flex-grow p-3 sm:p-4 md:p-6 overflow-y-auto space-y-5 sm:space-y-6 max-w-5xl w-full mx-auto"
        role="region"
        aria-labelledby={`${activeCategory}-settings-heading`}
      >
        {activeCategory === 'ai' && (
          <div id="ai-settings-content" className="space-y-5 sm:space-y-6">
            <section aria-labelledby="chat-model-heading" className="bg-[var(--surface-2)] p-3 sm:p-4 rounded-lg shadow">
              <h3 id="chat-model-heading" className="text-sm sm:text-md font-semibold text-[var(--text-primary)] mb-2 sm:mb-3 flex items-center">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[var(--primary)]" strokeWidth={1.5} aria-hidden="true" />
                Chat Model
              </h3>
              {availableModels.length > 0 ? (
                <>
                  <select
                    id="model-select"
                    value={currentModel}
                    onChange={(e) => onSetModel(e.target.value)}
                    className="w-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-color-light)] rounded-md p-2 sm:p-2.5 focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] focus:outline-none text-xs sm:text-sm"
                    aria-label="Select chat model"
                  >
                    {availableModels.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] xs:text-xs text-[var(--text-secondary)] mt-1.5 sm:mt-2">
                    The selected model will be used for this chat. Changes apply to new interactions.
                  </p>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] p-2 sm:p-2.5 bg-[var(--surface-3)] rounded-md">
                  Chat Model: Not Available.
                </p>
              )}
            </section>

            <section aria-labelledby="thinking-budget-heading" className="bg-[var(--surface-2)] p-3 sm:p-4 rounded-lg shadow">
              <h3 id="thinking-budget-heading" className="text-sm sm:text-md font-semibold text-[var(--text-primary)] mb-2 sm:mb-3 flex items-center">
                <BudgetIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[var(--primary)]" strokeWidth={1.5} aria-hidden="true" />
                 AI Thinking Budget
              </h3>
              <div className={`space-y-1 ${!isChatModelEffectivelyAvailable ? 'opacity-60' : ''}`}>
                <label htmlFor="thinking-budget-slider" className={`block text-xs sm:text-sm ${isThinkingBudgetApplicable ? 'text-[var(--text-primary)]' : 'text-[var(--text-placeholder)]'}`}>
                  Adjust thinking effort
                  {!isChatModelEffectivelyAvailable && <span className="text-[10px] xs:text-xs text-[var(--text-secondary)] ml-1">(Model Not Available)</span>}
                  {isChatModelEffectivelyAvailable && !isThinkingBudgetApplicable && <span className="text-[10px] xs:text-xs text-[var(--text-secondary)] ml-1">(Not applicable for '{currentModel}')</span>}
                </label>
                <div className="flex items-center space-x-2 sm:space-x-3 pt-1">
                  <input
                    type="range"
                    id="thinking-budget-slider"
                    value={thinkingBudget}
                    onChange={handleBudgetChange}
                    min="0"
                    max="5" 
                    step="1"
                    className={`w-full h-2 bg-[var(--surface-3)] rounded-lg appearance-none  
                      focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:ring-offset-1 focus:ring-offset-[var(--surface-1)]
                      ${!isThinkingBudgetApplicable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4 sm:[&::-webkit-slider-thumb]:w-5
                      [&::-webkit-slider-thumb]:h-4 sm:[&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:bg-[var(--primary)]
                      [&::-webkit-slider-thumb]:rounded-full
                      ${!isThinkingBudgetApplicable ? '[&::-webkit-slider-thumb]:bg-[var(--primary-hover)] opacity-50' : '[&::-webkit-slider-thumb]:cursor-pointer'}
                      [&::-moz-range-thumb]:w-4 sm:[&::-moz-range-thumb]:w-5
                      [&::-moz-range-thumb]:h-4 sm:[&::-moz-range-thumb]:h-5
                      [&::-moz-range-thumb]:bg-[var(--primary)]
                      [&::-moz-range-thumb]:rounded-full
                      ${!isThinkingBudgetApplicable ? '[&::-moz-range-thumb]:bg-[var(--primary-hover)] opacity-50' : '[&::-moz-range-thumb]:cursor-pointer'}
                      [&::-moz-range-thumb]:border-none
                    `}
                    aria-describedby="thinking-budget-description"
                    disabled={!isThinkingBudgetApplicable}
                  />
                  <span className={`text-xs sm:text-sm w-8 text-center tabular-nums ${!isThinkingBudgetApplicable ? 'text-[var(--text-placeholder)]' : 'text-[var(--text-primary)]'}`}>
                    {isThinkingBudgetApplicable ? thinkingBudget : '-'}
                  </span>
                </div>
                <p id="thinking-budget-description" className="text-[10px] xs:text-xs text-[var(--text-secondary)] mt-1.5 sm:mt-2">
                  Controls AI thinking effort. 0 for fastest response (thinking disabled). Higher values (1-5) allow more processing. 
                  Currently only applicable for the '{LEGACY_CHAT_MODEL_FOR_THINKING_CONFIG}' model.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* Features category content removed */}
        
        {activeCategory === 'appearance' && (
          <div id="appearance-settings-content" className="space-y-5 sm:space-y-6">
            <section aria-labelledby="theme-color-heading" className="bg-[var(--surface-2)] p-3 sm:p-4 rounded-lg shadow">
              <h3 id="theme-color-heading" className="text-sm sm:text-md font-semibold text-[var(--text-primary)] mb-3 sm:mb-4 flex items-center">
                <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[var(--primary)]" strokeWidth={1.5} aria-hidden="true" />
                Theme Color
              </h3>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {themeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => onSetTheme(option.value)}
                    className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-md text-xs sm:text-sm font-medium border transition-all
                      ${theme === option.value 
                        ? 'bg-[var(--primary)] text-[var(--text-on-primary)] border-[var(--primary-hover)] ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--surface-2)]' 
                        : 'bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color-light)] hover:border-[var(--primary)]'
                      }
                      focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1 focus:ring-offset-[var(--surface-2)]
                    `}
                    aria-pressed={theme === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
               <p className="text-[10px] xs:text-xs text-[var(--text-secondary)] mt-2 sm:mt-3">
                  Changes the primary accent color of the application.
               </p>
            </section>

            <section aria-labelledby="custom-css-heading" className="bg-[var(--surface-2)] p-3 sm:p-4 rounded-lg shadow">
              <h3 id="custom-css-heading" className="text-sm sm:text-md font-semibold text-[var(--text-primary)] mb-2 sm:mb-3 flex items-center">
                <Palette className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[var(--primary)]" strokeWidth={1.5} aria-hidden="true" />
                Custom Styles (Advanced)
              </h3>
              <textarea
                id="custom-css-input"
                value={customCSS}
                onChange={(e) => onSetCustomCSS(e.target.value)}
                rows={6}
                className="w-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-color-light)] rounded-lg p-2 sm:p-3 focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] focus:outline-none text-xs sm:text-sm font-mono placeholder-[var(--text-placeholder)]"
                placeholder="Enter custom CSS rules here, e.g., body { font-size: 18px; }"
                aria-label="Custom CSS input"
              />
              <p className="text-[10px] xs:text-xs text-[var(--text-secondary)] mt-1.5 sm:mt-2">
                Apply custom CSS to the entire application. Use with caution. Changes are applied immediately and saved locally.
              </p>
            </section>
          </div>
        )}

        <footer className="text-[10px] xs:text-xs text-[var(--text-secondary)] pt-3 sm:pt-4 text-center border-t border-[var(--border-color)] mt-3 sm:mt-4">
          Settings are applied globally or to the current chat context where applicable.
        </footer>
      </div>
    </div>
  );
};

export default SettingsPage;