import { useState, useEffect, useRef } from 'react';
import { Agent } from '../types';
import { AgentCard } from './AgentCard';
import { CommandModal } from './CommandModal';
import { useIndexedDB } from '../hooks/useIndexedDB';

interface AgentManagerProps {
  agents: Agent[];
  agentOutputs: Map<string, string[]>;
  onStartAgent: (data: {
    name: string;
    role: string;
    workDir: string;
    patterns: string[];
    sessionId?: string;
  }) => void;
  onStopAgent: (agentId: string) => void;
  onRestartAgent?: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  onExecuteCommand: (agentId: string, command: string) => void;
  onSendMessage?: (agentId: string, message: string) => void;
  commandOutputs: Map<string, { output: string; status: string }>;
}

export function AgentManager({
  agents,
  agentOutputs,
  onStartAgent,
  onStopAgent,
  onRestartAgent,
  onDeleteAgent,
  onExecuteCommand,
  onSendMessage,
  commandOutputs,
}: AgentManagerProps) {
  const [commandModalAgent, setCommandModalAgent] = useState<string | null>(null);
  const { getSession } = useIndexedDB();
  const agentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const currentCommandOutput = commandModalAgent
    ? commandOutputs.get(commandModalAgent)
    : undefined;

  // Alt+数字でエージェントのメッセージ入力欄にフォーカス
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < agents.length) {
          const agent = agents[index];
          const agentElement = agentRefs.current.get(agent.id);
          if (agentElement) {
            const textarea = agentElement.querySelector('textarea');
            if (textarea) {
              textarea.focus();
              // スクロールして表示
              agentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agents]);

  const handleLoadSession = async (_agentId: string, sessionId: string) => {
    const session = await getSession(sessionId);

    if (session) {
      // 過去のセッション情報で新しいエージェントを起動
      // 停止処理は不要 - 単に新しいエージェントを起動するだけ
      onStartAgent({
        name: session.agentName,
        role: session.role,
        workDir: session.workDir,
        patterns: session.patterns || ['**/*'],
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {agents.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-md m-4">
          No agents running
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-4 flex flex-wrap gap-3 overflow-auto content-start">
          {agents.map((agent, index) => (
            <div
              key={agent.id}
              ref={(el) => {
                if (el) agentRefs.current.set(agent.id, el);
                else agentRefs.current.delete(agent.id);
              }}
            >
              <AgentCard
                agent={agent}
                outputs={agentOutputs.get(agent.id) || []}
                onStop={onStopAgent}
                onRestart={onRestartAgent}
                onDelete={onDeleteAgent}
                onOpenCommand={(agentId) => setCommandModalAgent(agentId)}
                onSendMessage={onSendMessage}
                onLoadSession={handleLoadSession}
                shortcutNumber={index + 1}
              />
            </div>
          ))}
        </div>
      )}

      <CommandModal
        agentId={commandModalAgent || ''}
        agentName={agents.find(a => a.id === commandModalAgent)?.name || ''}
        isOpen={commandModalAgent !== null}
        onClose={() => setCommandModalAgent(null)}
        onExecute={onExecuteCommand}
        output={currentCommandOutput?.output}
        status={currentCommandOutput?.status}
      />
    </div>
  );
}
