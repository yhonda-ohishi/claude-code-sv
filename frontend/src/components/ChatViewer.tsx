import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';

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
  const [isSending, setIsSending] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [interruptNotification, setInterruptNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevOutputsLength = useRef(0);
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForResponseRef = useRef(false);


  // waitingForResponseの最新値をrefに保存
  useEffect(() => {
    waitingForResponseRef.current = waitingForResponse;
  }, [waitingForResponse]);

  // Convert outputs to messages (both user and assistant)
  useEffect(() => {
    // outputsがクリアされた場合
    if (outputs.length === 0) {
      setMessages([]);
      prevOutputsLength.current = 0;
      return;
    }

    // 新しい出力がある場合
    if (outputs.length > prevOutputsLength.current) {
      const newOutputs = outputs.slice(prevOutputsLength.current);

      if (waitingForResponseRef.current) {
        // タスク完了メッセージをチェック
        const hasTaskCompleted = newOutputs.some(output =>
          output.includes('✅ Task completed') ||
          output.includes('Task completed')
        );

        if (hasTaskCompleted) {
          // タスク完了メッセージが来たら即座に待機状態を解除
          if (responseTimeoutRef.current) {
            clearTimeout(responseTimeoutRef.current);
          }
          setWaitingForResponse(false);
        }
      }

      // 新しいメッセージのみを追加（既存のメッセージは保持）
      const baseTimestamp = Date.now();
      const startIndex = prevOutputsLength.current;

      const newMessages: ChatMessage[] = newOutputs.map((output, index) => {
        const absoluteIndex = startIndex + index;
        // Check if this is a user message (starts with "USER: ")
        if (output.startsWith('USER: ')) {
          return {
            id: `${agentId}-user-${absoluteIndex}`,
            role: 'user' as const,
            content: output.substring(6), // Remove "USER: " prefix
            timestamp: baseTimestamp + (index * 1000),
          };
        } else {
          return {
            id: `${agentId}-assistant-${absoluteIndex}`,
            role: 'assistant' as const,
            content: output,
            timestamp: baseTimestamp + (index * 1000),
          };
        }
      });

      // 既存のメッセージに新しいメッセージを追加
      setMessages(prev => [...prev, ...newMessages]);
      prevOutputsLength.current = outputs.length;
    }
    // outputs.lengthが減った場合（削除された場合）は全体を再構築
    else if (outputs.length < prevOutputsLength.current) {
      const baseTimestamp = Date.now() - outputs.length * 1000;

      const parsedMessages: ChatMessage[] = outputs.map((output, index) => {
        if (output.startsWith('USER: ')) {
          return {
            id: `${agentId}-user-${index}`,
            role: 'user' as const,
            content: output.substring(6),
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
      prevOutputsLength.current = outputs.length;
    }

    // クリーンアップ関数でタイムアウトをクリア
    return () => {
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
      }
    };
  }, [outputs, agentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    console.log('[DEBUG] handleSend called');
    if (!message.trim() || !onSendMessage || isSending) {
      console.log('[DEBUG] handleSend blocked - message:', message, 'onSendMessage:', !!onSendMessage, 'isSending:', isSending);
      return;
    }

    const messageToSend = message;
    setMessage(''); // 先にメッセージをクリア

    console.log('[DEBUG] Setting states - isSending=true, waitingForResponse=true');
    setIsSending(true);
    setWaitingForResponse(true);

    // 状態更新がUIに反映されるまで少し待つ
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Send message (parent component will add it to outputs with "USER: " prefix)
      await onSendMessage(messageToSend);
      console.log('[DEBUG] Message sent successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      // エラーの場合は待機状態も解除
      setWaitingForResponse(false);
    } finally {
      setIsSending(false);
      console.log('[DEBUG] isSending set to false');
      // waitingForResponseはエージェントからの応答があるまで継続
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    console.log('[DEBUG] handleKeyPress - key:', e.key, 'shiftKey:', e.shiftKey);

    // Escキーでエージェント実行を中断（textareaにフォーカスがある時のみ）
    if (e.key === 'Escape' && isRunning) {
      e.preventDefault();
      console.log('[ChatViewer] Interrupting agent execution (ESC key from textarea)');

      // エージェント実行を中断
      try {
        await apiClient.interruptAgent(agentId);

        // 中断成功後に待機表示をキャンセル
        setWaitingForResponse(false);
        setIsSending(false);
        if (responseTimeoutRef.current) {
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }

        setInterruptNotification({
          type: 'success',
          message: 'エージェントの実行を中断しました'
        });
        console.log('[ChatViewer] Agent interrupted successfully');
      } catch (error) {
        console.error('[ChatViewer] Failed to interrupt agent:', error);
        setInterruptNotification({
          type: 'error',
          message: 'エージェントの中断に失敗しました'
        });
      }

      // 通知を3秒後に自動で消す
      setTimeout(() => {
        setInterruptNotification(null);
      }, 3000);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('[DEBUG] Calling handleSend from handleKeyPress');
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg">
      {/* Interrupt Notification */}
      {interruptNotification && (
        <div
          className={`px-3 py-2 text-sm font-medium ${
            interruptNotification.type === 'success'
              ? 'bg-green-900 text-green-200 border-b border-green-700'
              : 'bg-red-900 text-red-200 border-b border-red-700'
          }`}
        >
          {interruptNotification.message}
        </div>
      )}

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
        <div className="border-t border-gray-700">
          {/* Processing Indicator */}
          {waitingForResponse && (
            <div className="px-2 py-1 bg-blue-900 bg-opacity-30 border-b border-blue-700 flex items-center justify-between gap-2 text-xs text-blue-300">
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{isSending ? 'メッセージを送信中...' : 'エージェントが処理中...'}</span>
              </div>
              <span className="text-[10px] opacity-60">ESCで中断</span>
            </div>
          )}

          {/* Input Area */}
          <div className="p-2">
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行、ESCで中断)"
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                rows={2}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || isSending}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-700 disabled:cursor-not-allowed text-xs"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
