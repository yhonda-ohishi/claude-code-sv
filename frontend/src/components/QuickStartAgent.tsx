import { useState } from 'react';
import { apiClient } from '../api/client';

interface QuickStartAgentProps {
  onStartAgent: (data: {
    name: string;
    role: string;
    workDir: string;
    patterns: string[];
  }) => void;
}

export function QuickStartAgent({ onStartAgent }: QuickStartAgentProps) {
  const [name, setName] = useState('');
  const [workDir, setWorkDir] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSelectingDir, setIsSelectingDir] = useState(false);

  const handleSelectDirectory = async () => {
    setIsSelectingDir(true);
    try {
      const result = await apiClient.selectDirectory();
      if (result.path) {
        setWorkDir(result.path);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      alert('フォルダ選択に失敗しました');
    } finally {
      setIsSelectingDir(false);
    }
  };

  const handleStart = () => {
    if (!name || !workDir) {
      alert('Name and Work Directory are required');
      return;
    }

    onStartAgent({
      name,
      role: name,
      workDir,
      patterns: ['**/*'],
    });

    setName('');
    setWorkDir('');
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-2 bg-white text-blue-600 rounded hover:bg-gray-100 transition font-medium"
      >
        🚀 新規エージェント
      </button>

      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl z-50 p-4">
            <h3 className="font-bold mb-3 text-gray-800">エージェント起動</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name:</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Frontend"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Directory (絶対パス):</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectDirectory}
                    disabled={isSelectingDir}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded transition text-sm disabled:bg-gray-100 disabled:cursor-wait"
                  >
                    {isSelectingDir ? '⏳' : '📁'}
                  </button>
                  <input
                    type="text"
                    value={workDir}
                    onChange={(e) => setWorkDir(e.target.value)}
                    placeholder="c:\js\my-project"
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  📁ボタンでフォルダ選択、または完全な絶対パスを入力
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                >
                  起動
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
