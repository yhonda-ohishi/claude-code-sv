import { useState, useEffect } from 'react';
import { AgentSession } from '../types';
import { useIndexedDB } from '../hooks/useIndexedDB';

interface AgentSessionHistoryProps {
  agentName: string;
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onClose: () => void;
}

export function AgentSessionHistory({ agentName, currentSessionId, onSelectSession, onClose }: AgentSessionHistoryProps) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAllSessions } = useIndexedDB();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const allSessions = await getAllSessions();
      // 同じエージェント名で、現在のセッション以外のものを表示
      const filtered = allSessions.filter(
        s => s.agentName === agentName && s.id !== currentSessionId && s.status === 'stopped'
      );
      setSessions(filtered);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = (session: AgentSession) => {
    if (!session.endedAt) return '実行中';
    const duration = session.endedAt - session.startedAt;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[70vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">📚 {agentName} の過去のセッション</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-sm"
          >
            ✕
          </button>
        </div>

        {/* セッション一覧 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              このエージェントの過去のセッションはありません
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {session.role}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          停止済み
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>📁 {session.workDir}</div>
                        <div>📅 開始: {formatDate(session.startedAt)}</div>
                        {session.endedAt && (
                          <div>⏱️ 実行時間: {getDuration(session)}</div>
                        )}
                        <div>💬 出力ログ: {session.outputLogs.length} 件</div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSession(session.id);
                        onClose();
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm ml-4"
                    >
                      読み込む
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
