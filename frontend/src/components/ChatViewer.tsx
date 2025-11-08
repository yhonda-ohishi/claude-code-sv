import { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatViewerProps {
  agentId: string;
  agentName: string;
  outputs: string[];
  onSendMessage?: (message: string) => void;
  isRunning: boolean;
}

export function ChatViewer({ agentId, agentName, outputs, onSendMessage, isRunning }: ChatViewerProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevOutputsLength = useRef(0);

  // Convert outputs to messages (both user and assistant)
  useEffect(() => {
    // Only update if outputs actually changed
    if (outputs.length === 0 && messages.length === 0) return;

    // Create a base timestamp for messages (oldest first)
    const baseTimestamp = Date.now() - outputs.length * 1000;

    const parsedMessages: ChatMessage[] = outputs.map((output, index) => {
      // Check if this is a user message (starts with "USER: ")
      if (output.startsWith('USER: ')) {
        return {
          id: `${agentId}-user-${index}`,
          role: 'user' as const,
          content: output.substring(6), // Remove "USER: " prefix
          timestamp: baseTimestamp + (index * 1000),
        };
      } else {
        return {
          id: `${agentId}-assistant-${index}`,
          role: 'assistant' as const,
          content: output,
          timestamp: baseTimestamp + (index * 1000),
        };
      }
    });

    setMessages(parsedMessages);
    // Clear local userMessages since they're now in outputs
    setUserMessages([]);
  }, [outputs]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !onSendMessage) return;

    // Send message (parent component will add it to outputs with "USER: " prefix)
    onSendMessage(message);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg">
      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">
            {agentName} からの応答を待っています...
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded px-2 py-1 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <div className="text-[10px] opacity-70 mb-0.5">
                  {msg.role === 'user' ? 'You' : agentName}
                </div>
                <div className="text-xs whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Area */}
      {onSendMessage && isRunning && (
        <div className="border-t border-gray-700 p-2">
          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-700 disabled:cursor-not-allowed text-xs"
            >
              送信
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
