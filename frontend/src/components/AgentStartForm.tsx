import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { SessionHistory } from './SessionHistory';
import { useIndexedDB } from '../hooks/useIndexedDB';

interface AgentStartFormProps {
  onStartAgent: (data: {
    name: string;
    role: string;
    workDir: string;
    patterns: string[];
    sessionId?: string;
  }) => void;
}

export function AgentStartForm({ onStartAgent }: AgentStartFormProps) {
  const [name, setName] = useState('');
  const [workDir, setWorkDir] = useState('');
  const [isSelectingDir, setIsSelectingDir] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const { getSession } = useIndexedDB();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Alt+0で新規エージェント起動フォームにフォーカス
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '0') {
        e.preventDefault();
        nameInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectDirectory = async () => {
    setIsSelectingDir(true);
    try {
      console.log('[AgentStartForm] Calling selectDirectory API...');
      const result = await apiClient.selectDirectory();
      console.log('[AgentStartForm] API response:', result);
      if (result.path) {
        console.log('[AgentStartForm] Setting workDir to:', result.path);
        setWorkDir(result.path);
      } else {
        console.log('[AgentStartForm] No path in response or cancelled:', result);
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
  };

  const handleContinueSession = async (sessionId: string) => {
    const session = await getSession(sessionId);

    if (session) {
      onStartAgent({
        name: session.agentName,
        role: session.role,
        workDir: session.workDir,
        patterns: session.patterns || ['**/*'],
        sessionId: session.id,
      });
    }
  };

  return (
    <>
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent Name"
            className="px-3 py-1.5 border rounded bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white text-sm w-32"
            title="Alt+0でフォーカス"
          />

          <div className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={handleSelectDirectory}
              disabled={isSelectingDir}
              className="px-2 py-1.5 bg-white/20 hover:bg-white/30 rounded transition text-sm disabled:bg-white/10 disabled:cursor-wait"
              title="Select Directory"
            >
              {isSelectingDir ? '⏳' : '📁'}
            </button>
            <input
              type="text"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              placeholder="Work Directory (絶対パス)"
              className="flex-1 px-3 py-1.5 border rounded bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white font-mono text-xs min-w-[200px]"
            />
          </div>

          <button
            onClick={handleStart}
            className="px-4 py-1.5 bg-white text-blue-600 rounded hover:bg-gray-100 transition font-medium text-sm whitespace-nowrap"
          >
            🚀 起動
          </button>

          <button
            onClick={() => setShowSessionHistory(true)}
            className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded transition font-medium text-sm whitespace-nowrap"
            title="過去のセッションから継続"
          >
            📚 履歴
          </button>
        </div>
      </div>

      {showSessionHistory && (
        <SessionHistory
          onSelectSession={handleContinueSession}
          onClose={() => setShowSessionHistory(false)}
        />
      )}
    </>
  );
}
