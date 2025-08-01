
import React, { useState, useCallback, ChangeEvent } from 'react';
import { X, UploadCloud, FileText, Type } from 'lucide-react';
import { FileUploadError } from '../types';

interface SummarizeTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSummarizeSubmit: (text: string) => void;
}

type InputMethod = 'text' | 'file';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const SummarizeTextModal: React.FC<SummarizeTextModalProps> = ({ isOpen, onClose, onSummarizeSubmit }) => {
  const [activeInputMethod, setActiveInputMethod] = useState<InputMethod>('text');
  const [inputText, setInputText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  const handleClose = useCallback(() => {
    setInputText('');
    setFileName(null);
    setFileContent(null);
    setError(null);
    setActiveInputMethod('text');
    setIsLoadingFile(false);
    onClose();
  }, [onClose]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      setFileContent(null);
      setError(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      setFileName(file.name);
      setFileContent(null);
      event.target.value = ''; 
      return;
    }

    const validTypes = ['text/plain', 'text/markdown'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setError('Invalid file type. Please upload a .txt or .md file.');
      setFileName(file.name);
      setFileContent(null);
      event.target.value = ''; 
      return;
    }
    
    setFileName(file.name);
    setError(null);
    setIsLoadingFile(true);

    try {
      const text = await readFileContent(file);
      setFileContent(text);
    } catch (err) {
      const fileError = err as FileUploadError;
      setError(fileError.message || 'Error reading file.');
      setFileContent(null);
    } finally {
      setIsLoadingFile(false);
       event.target.value = ''; 
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject({ message: 'Failed to read file.' } as FileUploadError);
      };
      reader.readAsText(file);
    });
  };

  const handleSubmit = () => {
    if (activeInputMethod === 'text') {
      if (!inputText.trim()) {
        setError('Please enter some text to summarize.');
        return;
      }
      onSummarizeSubmit(inputText);
    } else if (activeInputMethod === 'file') {
      if (!fileContent) {
        setError('No file content to summarize. Please upload a valid file.');
        return;
      }
      onSummarizeSubmit(fileContent);
    }
  };
  
  if (!isOpen) return null;

  const isSubmitDisabled = isLoadingFile || (activeInputMethod === 'text' && !inputText.trim()) || (activeInputMethod === 'file' && !fileContent);

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summarize-modal-title"
    >
      <div className="bg-[var(--surface-1)] text-[var(--text-primary)] p-5 sm:p-6 rounded-xl w-full max-w-lg border border-[var(--border-color)]"> {/* shadow-2xl removed */}
        <div className="flex justify-between items-center mb-5 sm:mb-6">
          <h2 id="summarize-modal-title" className="text-lg sm:text-xl font-semibold">Summarize Text</h2>
          <button 
            onClick={handleClose} 
            className="p-1.5 rounded-full hover:bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            aria-label="Close summarization modal"
          >
            <X className="h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]" />
          </button>
        </div>

        <div className="mb-4 sm:mb-5">
          <div className="flex border border-[var(--border-color)] rounded-lg p-0.5 sm:p-1 bg-[var(--background)]">
            <button
              onClick={() => setActiveInputMethod('text')}
              className={`flex-1 py-1.5 px-2 sm:py-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center space-x-1.5 sm:space-x-2
                ${activeInputMethod === 'text' ? 'bg-[var(--primary)] text-[var(--text-on-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'}`} // shadow-sm removed from active
              aria-pressed={activeInputMethod === 'text'}
            >
              <Type className="h-[14px] w-[14px] sm:h-[16px] sm:w-[16px]" /> 
              <span>Enter Text</span>
            </button>
            <button
              onClick={() => setActiveInputMethod('file')}
              className={`flex-1 py-1.5 px-2 sm:py-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center justify-center space-x-1.5 sm:space-x-2
                ${activeInputMethod === 'file' ? 'bg-[var(--primary)] text-[var(--text-on-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'}`} // shadow-sm removed from active
              aria-pressed={activeInputMethod === 'file'}
            >
              <FileText className="h-[14px] w-[14px] sm:h-[16px] sm:w-[16px]" />
              <span>Upload File</span>
            </button>
          </div>
        </div>

        {activeInputMethod === 'text' && (
          <div className="space-y-2 sm:space-y-3">
            <label htmlFor="text-input-summarize" className="block text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
              Paste or type text below:
            </label>
            <textarea
              id="text-input-summarize"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (error) setError(null);
              }}
              rows={6}
              className="w-full bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border-color-light)] rounded-lg p-2.5 sm:p-3 focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] focus:outline-none placeholder-[var(--text-placeholder)] text-xs sm:text-sm sm:rows-8"
              placeholder="Enter the text you want to summarize..."
            />
          </div>
        )}

        {activeInputMethod === 'file' && (
          <div className="space-y-2 sm:space-y-3">
            <label 
                htmlFor="file-upload-summarize" 
                className="w-full flex flex-col items-center justify-center p-4 sm:p-6 border-2 border-dashed border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--primary)] transition-colors bg-[var(--background)] hover:bg-[var(--surface-2)]"
            >
              <UploadCloud className="h-[30px] w-[30px] sm:h-[36px] sm:w-[36px] text-[var(--primary)] mb-1.5 sm:mb-2" />
              <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                {isLoadingFile ? "Reading file..." : (fileName || "Click to upload or drag and drop")}
              </span>
              <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">.txt or .md files (Max {MAX_FILE_SIZE_MB}MB)</span>
              <input
                id="file-upload-summarize"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoadingFile}
              />
            </label>
            {fileName && !isLoadingFile && fileContent && (
                 <p className="text-[10px] sm:text-xs text-green-400 text-center">File "{fileName}" ready for summarization.</p>
            )}
             {fileName && !isLoadingFile && !fileContent && !error && (
                 <p className="text-[10px] sm:text-xs text-yellow-400 text-center">Selected "{fileName}". Problems reading? Try again.</p>
            )}
          </div>
        )}
        
        {error && (
          <p className="text-xs sm:text-sm text-red-400 mt-2.5 sm:mt-3 bg-red-900/20 p-2 sm:p-2.5 rounded-md text-center" role="alert">{error}</p>
        )}

        <div className="mt-6 sm:mt-8 flex justify-end space-x-2 sm:space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-3)] hover:bg-[var(--surface-active)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-medium text-[var(--text-on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--surface-1)]
                        ${isSubmitDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoadingFile ? "Processing..." : "Summarize"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummarizeTextModal;
