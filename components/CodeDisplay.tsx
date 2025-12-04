import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CodeDisplayProps {
  code: string;
  title?: string;
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({ code, title = "GeneratedCode.mq5" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-gray-800 bg-gray-950 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-primary-500" />
          <span className="text-sm text-gray-400 font-mono">{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-xs text-gray-500 hover:text-primary-400 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="relative flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-sm leading-6">
        <pre className="text-gray-300 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeDisplay;