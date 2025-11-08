import { useState, useCallback, useEffect } from 'react';
import { AgentManager } from './components/AgentManager';
import { ChangeList } from './components/ChangeList';
import { AgentStartForm } from './components/AgentStartForm';
import { EditPermissionModal } from './components/EditPermissionModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useAgents } from './hooks/useAgents';
import { useChanges } from './hooks/useChanges';
import { useIndexedDB } from './hooks/useIndexedDB';
import { WSMessage, StartAgentRequest, EditPermissionRequest } from './types';
import { apiClient } from './api/client';

function App() {
  const [activeTab, setActiveTab] = useState<'agents' | 'changes'>('agents');
  const [agentOutputs, setAgentOutputs] = useState<Map<string, string[]>>(new Map());
  const [commandOutputs, setCommandOutputs] = useState<Map<string, { output: string; status: string }>>(new Map());
  const [editPermissionRequest, setEditPermissionRequest] = useState<EditPermissionRequest | null>(null);

  const { agents, startAgent, stopAgent, addAgent, removeAgent, updateAgent } = useAgents();
  const { changes, addChange, updateChangeStatus, acceptChange, declineChange, sendInstruction } = useChanges();
  const { saveSession, updateSessionStatus, saveOutputLog, saveChange, getAllSessions, getOutputLogs } = useIndexedDB();
  const [isRestoring, setIsRestoring] = useState(true);

  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    console.log('WebSocket message:', message);

    switch (message.type) {
      case 'agent_started':
        addAgent(message.data);
        // Save session to IndexedDB
        saveSession({
          id: message.data.sessionId,
          agentName: message.data.name,
          role: message.data.role,
          workDir: message.data.workDir,
          patterns: message.data.patterns,
          startedAt: message.data.startedAt,
          status: 'running',
          conversationHistory: [],
          outputLogs: [],
          changes: [],
        });
        break;

      case 'agent_stopped':
        updateAgent(message.data.agentId, { status: 'stopped' });
        updateSessionStatus(message.data.sessionId, 'stopped', Date.now());
        break;

      case 'new_change':
        addChange(message.data);
        saveChange(message.data);
        break;

      case 'status_update':
        updateChangeStatus(message.data.changeId, message.data.status);
        break;

      case 'agent_output':
        setAgentOutputs(prev => {
          const newMap = new Map(prev);
          const outputs = newMap.get(message.data.agentId) || [];
          newMap.set(message.data.agentId, [...outputs, message.data.output]);
          return newMap;
        });
        // Save to IndexedDB
        saveOutputLog(message.data.sessionId, {
          timestamp: message.data.timestamp,
          output: message.data.output,
          type: 'stdout',
        });
        break;

      case 'command_output':
        setCommandOutputs(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(message.data.commandId) || { output: '', status: '' };
          newMap.set(message.data.commandId, {
            output: current.output + message.data.output,
            status: message.data.status,
          });
          return newMap;
        });
        break;

      case 'command_completed':
        setCommandOutputs(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(message.data.commandId) || { output: '', status: '' };
          newMap.set(message.data.commandId, {
            ...current,
            status: message.data.status,
          });
          return newMap;
        });
        break;

      case 'edit_permission_request':
        console.log('Edit permission request received:', message.data);
        setEditPermissionRequest(message.data);
        break;
    }
  }, [addAgent, removeAgent, addChange, updateChangeStatus, saveSession, updateSessionStatus, saveOutputLog, saveChange]);

  const { isConnected } = useWebSocket(handleWebSocketMessage);

  // Restore data from IndexedDB on initial page load
  useEffect(() => {
    const restoreFromIndexedDB = async () => {
      try {
        console.log('[App] Restoring data from IndexedDB...');

        // Restore sessions and their output logs
        const sessions = await getAllSessions();
        console.log(`[App] Found ${sessions.length} sessions in IndexedDB`);

        for (const session of sessions) {
          // Only restore running sessions
          if (session.status === 'running') {
            console.log(`[App] Restoring session ${session.id} for agent ${session.agentName}`);

            // Load output logs for this session
            const logs = await getOutputLogs(session.id);
            console.log(`[App] Found ${logs.length} output logs for session ${session.id}`);

            // Find the agent ID from the current agents list (from server)
            const agent = agents.find(a => a.sessionId === session.id);
            if (agent) {
              // Restore outputs to state
              const outputs = logs.map(log => log.output);
              setAgentOutputs(prev => {
                const newMap = new Map(prev);
                newMap.set(agent.id, outputs);
                return newMap;
              });
              console.log(`[App] Restored ${outputs.length} outputs for agent ${agent.id}`);
            }
          }
        }

        console.log('[App] Data restoration complete');
      } catch (error) {
        console.error('[App] Failed to restore data from IndexedDB:', error);
      } finally {
        setIsRestoring(false);
      }
    };

    // Only restore if we have agents loaded from server
    if (agents.length > 0 && isRestoring) {
      restoreFromIndexedDB();
    } else if (agents.length === 0) {
      // No agents to restore
      setIsRestoring(false);
    }
  }, [agents, getAllSessions, getOutputLogs, isRestoring]);

  // Load agent outputs on initial mount only (not when agents change)
  useEffect(() => {
    agents.forEach(agent => {
      // Only load if we don't have outputs for this agent yet
      setAgentOutputs(prev => {
        // Skip if already loaded
        if (prev.has(agent.id)) {
          return prev;
        }

        // Load from API
        apiClient.getAgentOutput(agent.id)
          .then(outputResponse => {
            if (outputResponse.output && outputResponse.output.length > 0) {
              setAgentOutputs(current => {
                const newMap = new Map(current);
                newMap.set(agent.id, outputResponse.output);
                return newMap;
              });
            }
          })
          .catch(err => console.error(`Failed to load output for agent ${agent.id}:`, err));

        return prev;
      });
    });
  }, [agents]);

  // Load existing changes on startup
  useEffect(() => {
    const loadExistingChanges = async () => {
      try {
        const response = await apiClient.getChanges();
        console.log('Loaded existing changes:', response.changes);
        response.changes.forEach((change: any) => {
          addChange(change);
        });
      } catch (error) {
        console.error('Failed to load existing changes:', error);
      }
    };

    loadExistingChanges();
  }, [addChange]);

  const handleStartAgent = useCallback(async (data: StartAgentRequest) => {
    try {
      await startAgent(data);
    } catch (error) {
      console.error('Failed to start agent:', error);
    }
  }, [startAgent]);

  const handleStopAgent = useCallback(async (agentId: string) => {
    try {
      await stopAgent(agentId);
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  }, [stopAgent]);

  const handleRestartAgent = useCallback(async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {
        console.error('Agent not found:', agentId);
        return;
      }

      // エージェントを停止してから同じ設定で再起動
      const agentConfig = {
        name: agent.name,
        role: agent.role,
        workDir: agent.workDir,
        patterns: agent.patterns,
        // 新しいsessionIdで起動（古いsessionIdは使わない）
      };

      // 古いエージェントを削除してから起動
      try {
        await removeAgent(agentId);
      } catch (err) {
        console.log('Failed to delete old agent (may not exist on server):', err);
      }

      // 同じ設定で新しいエージェントを起動
      await startAgent(agentConfig);
    } catch (error) {
      console.error('Failed to restart agent:', error);
    }
  }, [agents, startAgent, removeAgent]);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {
        console.error('Agent not found:', agentId);
        return;
      }

      // 確認ダイアログを表示
      if (!confirm(`エージェント「${agent.name}」を削除しますか？`)) {
        return;
      }

      // エージェントを削除
      removeAgent(agentId);
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  }, [agents, removeAgent]);

  const handleExecuteCommand = useCallback((agentId: string, command: string) => {
    // This would be implemented with the API client
    console.log('Execute command:', agentId, command);
  }, []);

  const handleSendMessage = useCallback(async (agentId: string, message: string) => {
    try {
      // ユーザーメッセージを出力に追加（プレフィックス付き）
      setAgentOutputs(prev => {
        const newMap = new Map(prev);
        const outputs = newMap.get(agentId) || [];
        newMap.set(agentId, [...outputs, `USER: ${message}`]);
        return newMap;
      });

      // APIクライアントを使ってエージェントにメッセージを送信
      await apiClient.sendMessageToAgent(agentId, message);
      console.log('Message sent to agent:', agentId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('メッセージの送信に失敗しました');
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 固定ヘッダー */}
      <header className="bg-blue-600 text-white p-3 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold whitespace-nowrap">🤖 Multi-Agent Dashboard</h1>
            <div className="text-xs whitespace-nowrap">
              WebSocket: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <AgentStartForm onStartAgent={handleStartAgent} />
          </div>
        </div>
      </header>

      {/* 固定タブ */}
      <div className="flex border-b bg-white flex-shrink-0">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'agents'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          エージェント管理
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'changes'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          変更一覧
          {changes.filter(c => c.status === 'pending').length > 0 && (
            <span className="ml-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded-full">
              {changes.filter(c => c.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* メインコンテンツ - スクロールなし、各タブで独自に管理 */}
      <main className="flex-1 min-h-0">
        {activeTab === 'agents' ? (
          <AgentManager
            agents={agents}
            agentOutputs={agentOutputs}
            onStartAgent={handleStartAgent}
            onStopAgent={handleStopAgent}
            onRestartAgent={handleRestartAgent}
            onDeleteAgent={handleDeleteAgent}
            onExecuteCommand={handleExecuteCommand}
            onSendMessage={handleSendMessage}
            commandOutputs={commandOutputs}
          />
        ) : (
          <div className="h-full overflow-auto bg-gray-900">
            <div className="container mx-auto p-4">
              <div className="bg-[#0d1117] rounded-lg shadow-md border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-100">📝 変更提案一覧</h2>
                <ChangeList
                  changes={changes}
                  onAccept={acceptChange}
                  onDecline={declineChange}
                  onInstruction={sendInstruction}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 編集権限モーダル */}
      {editPermissionRequest && (
        <EditPermissionModal
          isOpen={true}
          onClose={() => setEditPermissionRequest(null)}
          onApprove={async () => {
            console.log('Approved edit for:', editPermissionRequest.filePath);
            try {
              await apiClient.approveEdit(editPermissionRequest.agentId, editPermissionRequest.toolUseId);
              console.log('Edit approval sent to server');
            } catch (error) {
              console.error('Failed to send edit approval:', error);
              alert('編集承認の送信に失敗しました。エージェントが再起動された可能性があります。');
            }
            setEditPermissionRequest(null);
          }}
          onReject={async () => {
            console.log('Rejected edit for:', editPermissionRequest.filePath);
            try {
              await apiClient.rejectEdit(editPermissionRequest.agentId, editPermissionRequest.toolUseId);
              console.log('Edit rejection sent to server');
            } catch (error) {
              console.error('Failed to send edit rejection:', error);
            }
            setEditPermissionRequest(null);
          }}
          filePath={editPermissionRequest.filePath}
          oldString={editPermissionRequest.oldString}
          newString={editPermissionRequest.newString}
        />
      )}
    </div>
  );
}

export default App;
