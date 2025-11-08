import { useState } from 'react';
import { Agent } from '../types';
import { AgentCard } from './AgentCard';
import { CommandModal } from './CommandModal';

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

  const currentCommandOutput = commandModalAgent
    ? commandOutputs.get(commandModalAgent)
    : undefined;

  return (
    <div className="h-full flex flex-col">
      {agents.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-md m-4">
          No agents running
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-4 flex flex-wrap gap-3 overflow-auto content-start">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              outputs={agentOutputs.get(agent.id) || []}
              onStop={onStopAgent}
              onRestart={onRestartAgent}
              onDelete={onDeleteAgent}
              onOpenCommand={(agentId) => setCommandModalAgent(agentId)}
              onSendMessage={onSendMessage}
            />
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
