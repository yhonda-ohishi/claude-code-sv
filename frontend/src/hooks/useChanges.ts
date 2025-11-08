import { useState, useCallback } from 'react';
import { Change } from '../types';
import { apiClient } from '../api/client';

export function useChanges() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addChange = useCallback((change: Change) => {
    setChanges(prev => [change, ...prev]);
  }, []);

  const updateChangeStatus = useCallback((changeId: string, status: Change['status']) => {
    setChanges(prev => prev.map(c => c.id === changeId ? { ...c, status } : c));
  }, []);

  const acceptChange = useCallback(async (changeId: string) => {
    try {
      setLoading(true);
      setError(null);
      updateChangeStatus(changeId, 'processing');
      await apiClient.acceptChange(changeId);
      updateChangeStatus(changeId, 'accepted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept change');
      console.error('Failed to accept change:', err);
      updateChangeStatus(changeId, 'pending');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateChangeStatus]);

  const declineChange = useCallback(async (changeId: string) => {
    try {
      setLoading(true);
      setError(null);
      updateChangeStatus(changeId, 'processing');
      await apiClient.declineChange(changeId);
      updateChangeStatus(changeId, 'declined');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline change');
      console.error('Failed to decline change:', err);
      updateChangeStatus(changeId, 'pending');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateChangeStatus]);

  const sendInstruction = useCallback(async (changeId: string, instruction: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.sendInstruction(changeId, { instruction });
      updateChangeStatus(changeId, 'processing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send instruction');
      console.error('Failed to send instruction:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [updateChangeStatus]);

  return {
    changes,
    loading,
    error,
    addChange,
    updateChangeStatus,
    acceptChange,
    declineChange,
    sendInstruction,
  };
}
