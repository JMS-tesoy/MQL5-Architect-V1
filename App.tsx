import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Code2, 
  Sparkles, 
  History, 
  Play, 
  Zap, 
  LineChart, 
  FileCode,
  AlertCircle,
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Send,
  Bot,
  User
} from 'lucide-react';
import { CodeType, GenerationHistoryItem, ChatMessage, ChatRole } from './types';
import { generateMql5, chatWithCode } from './services/geminiService';
import { extractTextFromPdf } from './utils/pdfHelper';
import Button from './components/Button';
import CodeDisplay from './components/CodeDisplay';

function App() {
  // Main State
  const [prompt, setPrompt] = useState('');
  const [codeType, setCodeType] = useState<CodeType>(CodeType.EXPERT_ADVISOR);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>('// Your MQL5 code will appear here...');
  const [explanation, setExplanation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Right Sidebar State
  const [activeTab, setActiveTab] = useState<'history' | 'chat'>('chat');
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // PDF State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfContent, setPdfContent] = useState<string>('');
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeTab]);

  const processFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError("Please upload a valid PDF file.");
      return;
    }

    setUploadedFile(file);
    setIsParsingPdf(true);
    setError(null);

    try {
      const text = await extractTextFromPdf(file);
      setPdfContent(text);
    } catch (err: any) {
      setError(err.message || "Failed to parse PDF.");
      setUploadedFile(null);
      setPdfContent('');
    } finally {
      setIsParsingPdf(false);
      // Reset input value to allow re-uploading the same file if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we are actually leaving the container (and not just entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;

    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const removeFile = () => {
    setUploadedFile(null);
    setPdfContent('');
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setExplanation('');
    setActiveTab('chat'); // Switch to chat to show results/assistant context
    
    try {
      // Simulate "Thinking" UI update
      setCurrentCode('// Analyzing requirements...\n// Reading documentation context...\n// Designing trading logic...\n// Generating MQL5 structures...');
      
      const result = await generateMql5(prompt, codeType, pdfContent);
      setCurrentCode(result.code);
      setExplanation(result.explanation);
      
      const newHistoryItem: GenerationHistoryItem = {
        id: Date.now().toString(),
        prompt: prompt,
        type: codeType,
        code: result.code,
        timestamp: Date.now()
      };
      
      setHistory(prev => [newHistoryItem, ...prev]);

      // Add initial system message to chat
      setChatMessages([{
        id: Date.now().toString(),
        role: 'model',
        content: `I've generated the ${codeType} code based on your request. ${result.explanation}`,
        timestamp: Date.now()
      }]);

    } catch (err: any) {
      setError(err.message || "Failed to generate code. Please try again.");
      setCurrentCode('// Error generating code.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, codeType, pdfContent]);

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Check if we have code context, if not, it's just a general question or init
      const contextCode = currentCode.startsWith('// Your MQL5 code') ? '' : currentCode;

      const result = await chatWithCode(contextCode, chatMessages, userMsg.content, pdfContent);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: result.reply,
        hasCodeUpdate: !!result.updatedCode,
        timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, aiMsg]);

      if (result.updatedCode) {
        setCurrentCode(result.updatedCode);
        // Provide visual feedback that code was updated?
      }

    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        content: "I encountered an error while processing your request. Please try again.",
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const restoreFromHistory = (item: GenerationHistoryItem) => {
    setPrompt(item.prompt);
    setCodeType(item.type);
    setCurrentCode(item.code);
    setExplanation("// Restored from history");
    setChatMessages([{
      id: Date.now().toString(),
      role: 'model',
      content: `Restored version: ${item.prompt}`,
      timestamp: Date.now()
    }]);
    setActiveTab('chat');
  };

  const getIconForType = (type: CodeType) => {
    switch (type) {
      case CodeType.EXPERT_ADVISOR: return <Zap className="w-4 h-4" />;
      case CodeType.INDICATOR: return <LineChart className="w-4 h-4" />;
      case CodeType.SCRIPT: return <FileCode className="w-4 h-4" />;
      default: return <Code2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-200 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-900/30 p-2 rounded-lg border border-primary-500/20">
              <Code2 className="w-6 h-6 text-primary-400" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              MQL5 Architect
            </h1>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span className="hidden md:inline">Powered by Gemini 2.0</span>
            <a href="https://www.mql5.com/en/docs" target="_blank" rel="noreferrer" className="hover:text-primary-400 transition-colors">Docs</a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input & Controls (3 cols) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-[calc(100vh-8rem)]">
          
          <div className="space-y-6 bg-gray-900/50 p-6 rounded-xl border border-gray-800 shadow-xl overflow-y-auto custom-scrollbar flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Artifact Type</label>
              <div className="grid grid-cols-1 gap-2">
                {[CodeType.EXPERT_ADVISOR, CodeType.INDICATOR, CodeType.SCRIPT].map((type) => (
                  <button
                    key={type}
                    onClick={() => setCodeType(type)}
                    className={`flex items-center px-4 py-3 rounded-lg border text-xs font-medium transition-all ${
                      codeType === type
                        ? 'bg-primary-900/20 border-primary-500 text-primary-400'
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="mr-3">{getIconForType(type)}</div>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Documentation (Optional)
              </label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="application/pdf" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              
              {!uploadedFile && !isParsingPdf && (
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    w-full border border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all group
                    ${isDragging 
                      ? 'border-primary-500 bg-primary-900/20 text-primary-400 scale-[1.02]' 
                      : 'border-gray-700 text-gray-500 hover:text-primary-400 hover:border-primary-500/50 hover:bg-gray-800/50'
                    }
                  `}
                >
                  <Upload className={`w-5 h-5 mb-2 transition-transform ${isDragging ? 'scale-110' : 'group-hover:-translate-y-1'}`} />
                  <span className="text-xs font-medium">{isDragging ? 'Drop PDF here' : 'Upload PDF'}</span>
                </div>
              )}

              {isParsingPdf && (
                <div className="w-full border border-gray-800 bg-gray-900 rounded-lg p-4 flex items-center justify-center space-x-3 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                  <span className="text-xs">Parsing...</span>
                </div>
              )}

              {uploadedFile && !isParsingPdf && (
                <div className="w-full border border-primary-900/50 bg-primary-900/10 rounded-lg p-3 flex items-center justify-between group">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="bg-primary-900/50 p-1.5 rounded">
                      <FileText className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-gray-200 truncate pr-2 max-w-[150px]">
                        {uploadedFile.name}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={removeFile}
                    className="p-1.5 hover:bg-red-900/30 rounded-full text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Initial Strategy
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your strategy..."
                className="w-full h-32 bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:outline-none resize-none"
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              isLoading={isGenerating} 
              disabled={!prompt.trim() || isParsingPdf}
              className="w-full py-3 text-base"
              icon={<Sparkles className="w-5 h-5" />}
            >
              Generate
            </Button>
            
            {error && (
               <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-start space-x-3 text-xs text-red-300">
                 <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                 <span>{error}</span>
               </div>
            )}
          </div>
        </div>

        {/* Center Column: Code Output (6 cols) */}
        <div className="lg:col-span-6 h-[calc(100vh-8rem)]">
          <CodeDisplay code={currentCode} title={`${codeType.replace(' ', '')}_Gen.mq5`} />
        </div>

        {/* Right Column: Assistant/History (3 cols) */}
        <div className="lg:col-span-3 flex flex-col h-[calc(100vh-8rem)] bg-gray-900/30 rounded-xl border border-gray-800 overflow-hidden">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-900/50">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center transition-colors ${
                activeTab === 'chat' 
                  ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-900/10' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Assistant
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center transition-colors ${
                activeTab === 'history' 
                  ? 'text-primary-400 border-b-2 border-primary-500 bg-primary-900/10' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <History className="w-4 h-4 mr-2" />
              History
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            
            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                {chatMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-50">
                    <Bot className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-sm text-gray-500">Generate code to start chatting with the assistant.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {chatMessages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`
                            max-w-[90%] rounded-lg p-3 text-sm leading-relaxed relative
                            ${msg.role === 'user' 
                              ? 'bg-primary-600 text-white rounded-br-none' 
                              : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                            }
                          `}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.hasCodeUpdate && (
                             <div className="mt-2 pt-2 border-t border-gray-700 flex items-center text-xs text-green-400 font-mono">
                               <CheckCircle2 className="w-3 h-3 mr-1.5" />
                               Code updated
                             </div>
                          )}
                          <span className="text-[10px] opacity-50 block mt-1 text-right">
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {isChatLoading && (
                      <div className="flex justify-start">
                         <div className="bg-gray-800 rounded-lg rounded-bl-none p-3 border border-gray-700 flex items-center space-x-2">
                            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                         </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Chat Input */}
                <div className="p-3 bg-gray-900 border-t border-gray-800">
                  <form onSubmit={handleChatSubmit} className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask to change code..."
                      disabled={isChatLoading || chatMessages.length === 0}
                      className="w-full bg-gray-950 border border-gray-700 text-gray-200 text-sm rounded-lg pl-3 pr-10 py-3 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isChatLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-500 disabled:opacity-50 disabled:bg-gray-700 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="h-full overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <p className="text-xs text-gray-600">No generations yet.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => restoreFromHistory(item)}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-gray-500 group-hover:text-primary-400">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;