import { useState } from 'react';

interface CommandModalProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (agentId: string, command: string) => void;
  output?: string;
  status?: string;
}

export function CommandModal({ agentId, agentName, isOpen, onClose, onExecute, output = '', status }: CommandModalProps) {
  const [command, setCommand] = useState('');

  if (!isOpen) return null;

  const handleExecute = () => {
    if (command.trim()) {
      onExecute(agentId, command);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">💻 コマンド実行 - {agentName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Command:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleExecute()}
              placeholder="例: npm test"
              className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleExecute}
              disabled={!command.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              実行
            </button>
          </div>
        </div>

        {output && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📋 出力:
            </label>
            <div className="bg-black text-green-400 font-mono text-sm p-4 rounded h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{output}</pre>
              {status === 'completed' && (
                <div className="text-blue-400 mt-2">[完了]</div>
              )}
              {status === 'running' && (
                <div className="text-yellow-400 mt-2">[実行中...]</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
