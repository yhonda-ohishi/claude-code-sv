import { useState, useEffect, useRef } from 'react';

interface ConsoleViewerProps {
  agentId: string;
  agentName: string;
  outputs: string[];
}

export function ConsoleViewer({ outputs }: ConsoleViewerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [outputs, isExpanded]);

  return (
    <div className="mt-3 border rounded">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-left flex justify-between items-center"
      >
        <span className="font-medium">📺 Console Output</span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div
          ref={consoleRef}
          className="bg-black text-green-400 font-mono text-xs p-3 h-64 overflow-y-auto"
        >
          {outputs.length === 0 ? (
            <div className="text-gray-500">No output yet...</div>
          ) : (
            outputs.map((output, index) => (
              <div key={index} className="whitespace-pre-wrap break-all">
                {output}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
