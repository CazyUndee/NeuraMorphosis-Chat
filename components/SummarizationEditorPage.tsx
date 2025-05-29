
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { X, Download, MessageSquarePlus, SendHorizonal as SendHorizontal, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SummarizationEditorPageProps {
  originalText: string;
  onClose: () => void;
  currentChatModelName: string;
}

const followUpMarkdownComponents = {
  p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc list-inside my-2 ml-4 space-y-1" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal list-inside my-2 ml-4 space-y-1" {...props} />,
  a: ({node, ...props}: any) => <a className="text-[var(--primary)] hover:text-[var(--primary-hover)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
};

const REPLACE_SUMMARY_COMMAND = "[replace_summary_with_new_text]";

const SummarizationEditorPage: React.FC<SummarizationEditorPageProps> = ({
  originalText,
  onClose,
  currentChatModelName,
}) => {
  const [displayText, setDisplayText] = useState<string>(originalText);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummaryComplete, setIsSummaryComplete] = useState<boolean>(false);
  
  const [showFollowUp, setShowFollowUp] = useState<boolean>(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [followUpResponse, setFollowUpResponse] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [didFollowUpActAsReplacement, setDidFollowUpActAsReplacement] = useState<boolean>(false);


  const [aiInstance, setAiInstance] = useState<GoogleGenAI | null>(null);
  const hasSummarizationStartedRef = useRef(false);
  const isReplacingSummaryRef = useRef(false); 

  useEffect(() => {
    if (!process.env.API_KEY) {
      console.error('API_KEY environment variable not set for Summarization Editor.');
      setSummaryError('Configuration error: API Key not found. Cannot summarize.');
      return;
    }
    const newAiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    setAiInstance(newAiInstance);
  }, []);

  const handleSummarize = useCallback(async () => {
    if (!aiInstance || !originalText.trim() || isSummarizing) {
      if (!originalText.trim()) setSummaryError('Original text is empty, nothing to summarize.');
      else if (!aiInstance) setSummaryError('AI service not initialized.');
      return;
    }

    setIsSummarizing(true);
    setSummaryError(null);
    setIsSummaryComplete(false);
    
    const prompt = `Concisely summarize the following text. Focus on extracting the key points and main narrative. Do not add any conversational fluff or introductory/concluding phrases like 'Here is the summary:' or 'In conclusion...'. Just provide the summary itself, ensuring it's suitable for direct display in a text editor.\n\nOriginal Text:\n${originalText}\n\nSummary:`;
    
    let firstChunkReceived = false;
    try {
      const stream = await aiInstance.models.generateContentStream({
        model: currentChatModelName,
        contents: prompt,
      });

      let currentSummaryAccumulator = "";
      for await (const chunk of stream) {
        if (chunk.text) {
          if (!firstChunkReceived) {
            setDisplayText(chunk.text); 
            currentSummaryAccumulator = chunk.text;
            firstChunkReceived = true;
          } else {
            currentSummaryAccumulator += chunk.text;
            setDisplayText(currentSummaryAccumulator);
          }
        }
      }
      if (!firstChunkReceived && currentSummaryAccumulator === "") {
         setDisplayText(""); 
         setSummaryError("AI returned an empty summary.");
      }
    } catch (e: any) {
      console.error('Error during summarization stream:', e);
      setSummaryError(`Summarization failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSummarizing(false);
      setIsSummaryComplete(true);
    }
  }, [aiInstance, originalText, currentChatModelName, isSummarizing]);

  useEffect(() => {
    if (aiInstance && originalText && !hasSummarizationStartedRef.current && !isSummarizing) {
      hasSummarizationStartedRef.current = true;
      const timer = setTimeout(() => {
        handleSummarize();
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [aiInstance, originalText, handleSummarize, isSummarizing]);


  const handleExportSummary = () => {
    if (!displayText.trim() || !isSummaryComplete) {
      alert('Nothing to export. The summary is empty or not yet generated.');
      return;
    }
    const blob = new Blob([displayText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'summary.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleAskFollowUp = async () => {
    if (!aiInstance || !followUpQuestion.trim() || !displayText.trim() || !isSummaryComplete) {
      setFollowUpError('Cannot ask follow-up: AI service not ready, question is empty, or no summary context available.');
      return;
    }
    setIsAskingFollowUp(true);
    setFollowUpError(null);
    setFollowUpResponse('');
    setDidFollowUpActAsReplacement(false);
    isReplacingSummaryRef.current = false;

    const followUpSystemPrompt = `You are assisting a user with a summary. The current summary is provided below. The user has a follow-up question or request.

If the user's request requires you to *rewrite or modify the summary itself* (e.g., make it shorter, longer, rephrase a section, add information), you MUST:
1. First, output the exact command on its own line: ${REPLACE_SUMMARY_COMMAND}
2. THEN, on new lines, provide the *complete, new, revised summary text*. Do not include any other conversational text before or after the revised summary in this case.

If the user's request is a question *about* the summary that does not require changing the summary text (e.g., "What was the source for this?"), then answer the question directly without using the ${REPLACE_SUMMARY_COMMAND} command.

Current Summary:
${displayText}

User's Request:
${followUpQuestion}

Your Response:`;

    let revisedSummaryAccumulator = "";
    let currentFollowUpTextAccumulator = "";

    try {
      const stream = await aiInstance.models.generateContentStream({
        model: currentChatModelName,
        contents: followUpSystemPrompt,
      });

      for await (const chunk of stream) {
        const textChunk = chunk.text;
        if (textChunk) {
          if (!isReplacingSummaryRef.current && textChunk.includes(REPLACE_SUMMARY_COMMAND)) {
            isReplacingSummaryRef.current = true;
            setDidFollowUpActAsReplacement(true);
            const textAfterCommand = textChunk.substring(textChunk.indexOf(REPLACE_SUMMARY_COMMAND) + REPLACE_SUMMARY_COMMAND.length).trimStart();
            if (textAfterCommand) {
              revisedSummaryAccumulator += textAfterCommand;
              setDisplayText(revisedSummaryAccumulator);
            }
            continue; 
          }

          if (isReplacingSummaryRef.current) {
            revisedSummaryAccumulator += textChunk;
            setDisplayText(revisedSummaryAccumulator);
          } else {
            currentFollowUpTextAccumulator += textChunk;
            setFollowUpResponse(currentFollowUpTextAccumulator);
          }
        }
      }
      if (isReplacingSummaryRef.current && revisedSummaryAccumulator === "") {
        setDisplayText("");
      }

    } catch (e: any) {
      console.error('Error during follow-up question stream:', e);
      setFollowUpError(`Follow-up failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsAskingFollowUp(false);
    }
  };
  
  let placeholderText = "Original text will be replaced by summary...";
  if (isSummarizing && !displayText && !hasSummarizationStartedRef.current) {
    placeholderText = "Preparing to summarize original text...";
  } else if (isSummarizing) {
    placeholderText = "AI is generating summary...";
  } else if (isSummaryComplete && !displayText && !summaryError) {
    placeholderText = "Summary is empty.";
  } else if (isSummaryComplete && summaryError) {
    placeholderText = "Error occurred. Summary not available.";
  }


  return (
    <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <header className="bg-[var(--surface-1)] p-3 sm:p-4 shadow-md flex items-center justify-between z-20 h-[60px] flex-shrink-0">
        <h2 id="summarizer-title" className="text-base sm:text-lg md:text-xl font-semibold text-[var(--text-primary)] ml-2">
          Summarization Editor
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] flex items-center"
          aria-label="Close summarization editor"
        >
          <X className="w-5 h-5 sm:mr-1 md:mr-2" />
          <span className="hidden sm:inline text-sm">Close Editor</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-5 sm:space-y-6" role="document" aria-labelledby="summarizer-title">
        <section aria-labelledby="summary-heading" className="bg-[var(--surface-2)] p-3 sm:p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-2 sm:mb-3">
            <h3 id="summary-heading" className="text-sm sm:text-md font-semibold text-[var(--text-primary)]">
              {isSummarizing ? "Generating Summary..." : (isSummaryComplete ? "Editable Summary" : "Original Text")}
            </h3>
            {isSummarizing && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)] animate-spin" />}
            {!isSummarizing && summaryError && <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />}
            {!isSummarizing && !summaryError && isSummaryComplete && displayText && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />}
          </div>
          {summaryError && (
            <p className="text-xs sm:text-sm text-red-400 bg-red-900/20 p-2 sm:p-2.5 rounded-md mb-2 sm:mb-3" role="alert">{summaryError}</p>
          )}
          <textarea
            value={displayText}
            onChange={(e) => {
              if(isSummaryComplete && !isSummarizing) {
                setDisplayText(e.target.value);
              }
            }}
            placeholder={placeholderText}
            readOnly={isSummarizing || !isSummaryComplete}
            rows={12} 
            className="w-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-color-light)] rounded-lg p-2 sm:p-3 focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] focus:outline-none text-xs sm:text-sm placeholder-[var(--text-placeholder)] md:rows-15"
            aria-label="Text content area"
          />
          <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={handleExportSummary}
              disabled={isSummarizing || !isSummaryComplete || !displayText.trim()}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-[var(--text-on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 sm:space-x-2"
            >
              <Download className="h-[14px] w-[14px] sm:h-[16px] sm:w-[16px]" />
              <span>Export Summary</span>
            </button>
            <button
              onClick={() => setShowFollowUp(!showFollowUp)}
              disabled={isSummarizing || !isSummaryComplete || !displayText.trim()}
              className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-3)] hover:bg-[var(--surface-active)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 sm:space-x-2"
              aria-expanded={showFollowUp}
            >
              <MessageSquarePlus className="h-[14px] w-[14px] sm:h-[16px] sm:w-[16px]" />
              <span>{showFollowUp ? 'Hide Follow-up' : 'Ask Follow-up'}</span>
            </button>
          </div>
        </section>

        {showFollowUp && isSummaryComplete && (
          <section aria-labelledby="follow-up-heading" className="bg-[var(--surface-2)] p-3 sm:p-4 rounded-lg shadow transition-all duration-300 ease-in-out">
            <h3 id="follow-up-heading" className="text-sm sm:text-md font-semibold text-[var(--text-primary)] mb-2 sm:mb-3">
              Follow-up Question
            </h3>
            <div className="space-y-2 sm:space-y-3">
              <textarea
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                placeholder="Ask a question about the summary or request a revision..."
                rows={2}
                className="w-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-color-light)] rounded-lg p-2 sm:p-3 focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] focus:outline-none text-xs sm:text-sm placeholder-[var(--text-placeholder)] sm:rows-3"
                aria-label="Follow-up question input"
              />
              <button
                onClick={handleAskFollowUp}
                disabled={isAskingFollowUp || !followUpQuestion.trim()}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-[var(--text-on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 sm:space-x-2"
              >
                {isAskingFollowUp ? <Loader2 className="animate-spin h-[14px] w-[14px] sm:h-[16px] sm:w-[16px]" /> : <SendHorizontal className="h-[14px] w-[14px] sm:h-[16px] sm:w-[16px]" />}
                <span>Send Question</span>
              </button>
            </div>
            {followUpError && (
              <p className="text-xs sm:text-sm text-red-400 bg-red-900/20 p-2 sm:p-2.5 rounded-md mt-2 sm:mt-3" role="alert">{followUpError}</p>
            )}
            { !didFollowUpActAsReplacement && (followUpResponse || isAskingFollowUp) && (
              <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">AI Response:</h4>
                <div className="text-xs sm:text-sm text-[var(--text-primary)] bg-[var(--background)] p-2 sm:p-3 rounded-md border border-[var(--border-color-light)] min-h-[50px] sm:min-h-[60px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={followUpMarkdownComponents}>
                        {followUpResponse || (isAskingFollowUp ? "AI is thinking..." : "")}
                    </ReactMarkdown>
                </div>
              </div>
            )}
          </section>
        )}
         <footer className="text-[10px] xs:text-xs text-[var(--text-secondary)] pt-3 sm:pt-4 text-center border-t border-[var(--border-color)] mt-auto">
          Summarization Editor - Powered by NeuraMorphosis AI
        </footer>
      </div>
    </div>
  );
};

export default SummarizationEditorPage;
