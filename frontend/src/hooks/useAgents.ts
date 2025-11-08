import { useState, useCallback, useEffect } from 'react';
import { Agent, StartAgentRequest } from '../types';
import { apiClient } from '../api/client';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAgents();
      setAgents(response.agents);

      // Return agents for output loading
      return response.agents;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      console.error('Failed to fetch agents:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const startAgent = useCallback(async (data: StartAgentRequest) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.startAgent(data);
      await fetchAgents();
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start agent');
      console.error('Failed to start agent:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  const stopAgent = useCallback(async (agentId: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.stopAgent({ agentId });
      await fetchAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop agent');
      console.error('Failed to stop agent:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAgents]);

  const addAgent = useCallback((agent: Agent) => {
    setAgents(prev => {
      // 重複チェック
      if (prev.some(a => a.id === agent.id)) {
        return prev;
      }
      return [...prev, agent];
    });
  }, []);

  const removeAgent = useCallback(async (agentId: string) => {
    try {
      // サーバー側のエージェントを削除
      await apiClient.deleteAgent(agentId);
      // ローカル状態を更新
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (err) {
      console.error('Failed to delete agent:', err);
      throw err;
    }
  }, []);

  const updateAgent = useCallback((agentId: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, ...updates } : a));
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    loading,
    error,
    startAgent,
    stopAgent,
    fetchAgents,
    addAgent,
    removeAgent,
    updateAgent,
  };
}
