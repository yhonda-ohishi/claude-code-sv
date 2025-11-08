import { useState } from 'react';
import { Change } from '../types';
import { DiffViewer } from './DiffViewer';

interface ChangeCardProps {
  change: Change;
  onAccept: (changeId: string) => void;
  onDecline: (changeId: string) => void;
  onInstruction: (changeId: string, instruction: string) => void;
}

export function ChangeCard({ change, onAccept, onDecline, onInstruction }: ChangeCardProps) {
  const [instruction, setInstruction] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusColor = () => {
    switch (change.status) {
      case 'pending':
        return 'text-yellow-600';
      case 'accepted':
        return 'text-green-600';
      case 'declined':
        return 'text-red-600';
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (change.status) {
      case 'pending':
        return '⏳';
      case 'accepted':
        return '✓';
      case 'declined':
        return '✗';
      case 'processing':
        return '⟳';
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const handleSendInstruction = () => {
    if (instruction.trim()) {
      onInstruction(change.id, instruction);
      setInstruction('');
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 mb-4 bg-[#0d1117] shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg text-gray-100">Change #{change.id.slice(-6)}</h3>
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusIcon()} {change.status.charAt(0).toUpperCase() + change.status.slice(1)}
            </span>
          </div>
          <div className="text-sm text-gray-400">
            <div>Agent: <span className="font-medium text-gray-300">{change.agentName}</span></div>
            <div>File: <span className="font-mono text-xs text-gray-300">{change.filePath}</span></div>
            <div>Time: {formatTimestamp(change.timestamp)}</div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-200"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="mb-4">
            <DiffViewer
              before={change.before}
              after={change.after}
              fileName={change.filePath}
            />
          </div>

          {change.status === 'pending' && (
            <>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => onAccept(change.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => onDecline(change.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  ✗ Decline
                </button>
              </div>

              <div className="border-t border-gray-700 pt-3">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  💬 追加指示:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendInstruction()}
                    placeholder="例: エラーハンドリングを追加してください"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendInstruction}
                    disabled={!instruction.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-700 disabled:cursor-not-allowed"
                  >
                    送信
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
