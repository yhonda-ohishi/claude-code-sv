import { AgentSession } from '../types';

interface SessionSelectorProps {
  sessions: AgentSession[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string | null) => void;
}

export function SessionSelector({ sessions, selectedSessionId, onSelect }: SessionSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        📜 過去のセッションから開始 (オプション)
      </label>
      <select
        value={selectedSessionId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">新規セッション</option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.agentName} - {new Date(session.startedAt).toLocaleString()}
            ({session.conversationHistory.length} messages)
            {session.status === 'running' ? ' [Running]' : ' [Stopped]'}
          </option>
        ))}
      </select>
    </div>
  );
}
