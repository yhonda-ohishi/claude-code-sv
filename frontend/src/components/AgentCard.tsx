import { useState } from 'react';
import { Agent } from '../types';
import { ChatViewer } from './ChatViewer';
import { AgentSessionHistory } from './AgentSessionHistory';

interface AgentCardProps {
  agent: Agent;
  outputs: string[];
  messageCount?: number;
  onStop: (agentId: string) => void;
  onRestart?: (agentId: string) => void;
  onDelete?: (agentId: string) => void;
  onOpenCommand: (agentId: string) => void;
  onSendMessage?: (agentId: string, message: string) => void;
  onLoadSession?: (agentId: string, sessionId: string) => void;
  shortcutNumber?: number;
}

export function AgentCard({ agent, outputs, messageCount = 0, onStop, onRestart, onDelete, onOpenCommand, onSendMessage, onLoadSession, shortcutNumber }: AgentCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  return (
    <div className="border rounded-lg mb-3 bg-white shadow-sm flex flex-col h-full w-[400px]">
      {/* 固定ヘッダー - スクロールしない */}
      <div className="p-2 border-b bg-gray-50 flex-shrink-0 sticky top-0 z-10 bg-gray-50">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 min-w-0 flex-1 cursor-help"
            title={`Name: ${agent.name}\nRole: ${agent.role}\nSession: ${agent.sessionId}\nWork Dir: ${agent.workDir}\nPatterns: ${agent.patterns.join(', ')}\nMessages: ${messageCount}${shortcutNumber ? `\nShortcut: Alt+${shortcutNumber}` : ''}`}
          >
            {shortcutNumber && shortcutNumber <= 9 && (
              <span className="text-xs font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded flex-shrink-0">
                {shortcutNumber}
              </span>
            )}
            <span className="text-base">{agent.status === 'running' ? '✅' : '⏹️'}</span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-semibold text-sm truncate">{agent.name}</span>
              <span className="text-[10px] text-gray-500 truncate">{agent.workDir}</span>
            </div>
            <span className="text-[10px] text-gray-500 whitespace-nowrap">({formatTimestamp(agent.startedAt)})</span>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {agent.status === 'running' ? (
              <button
                onClick={() => onStop(agent.id)}
                className="w-7 h-7 flex items-center justify-center bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                title="停止"
              >
                ⏹️
              </button>
            ) : (
              <>
                {onRestart && (
                  <button
                    onClick={() => onRestart(agent.id)}
                    className="w-7 h-7 flex items-center justify-center bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
                    title="再起動"
                  >
                    🔄
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(agent.id)}
                    className="w-7 h-7 flex items-center justify-center bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
                    title="削除"
                  >
                    🗑️
                  </button>
                )}
              </>
            )}
            {onLoadSession && (
              <button
                onClick={() => setShowHistory(true)}
                className="w-7 h-7 flex items-center justify-center bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm"
                title="過去のセッションを読み込む"
              >
                📚
              </button>
            )}
            <button
              onClick={() => onOpenCommand(agent.id)}
              className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
              title="コマンド"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* チャットビューアー - スクロール可能 */}
      <div className="flex-1 min-h-0">
        <ChatViewer
          agentId={agent.id}
          agentName={agent.name}
          outputs={outputs}
          onSendMessage={onSendMessage ? (message) => onSendMessage(agent.id, message) : undefined}
          isRunning={agent.status === 'running'}
        />
      </div>

      {/* 履歴モーダル */}
      {showHistory && onLoadSession && (
        <AgentSessionHistory
          agentName={agent.name}
          currentSessionId={agent.sessionId}
          onSelectSession={(sessionId) => onLoadSession(agent.id, sessionId)}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
