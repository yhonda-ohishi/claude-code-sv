import { useCallback } from 'react';
import { db } from '../db/schema';
import { AgentSession, OutputLog, Change } from '../types';

export function useIndexedDB() {
  // Session operations
  const saveSession = useCallback(async (session: AgentSession) => {
    await db.sessions.put(session);
  }, []);

  const getSession = useCallback(async (sessionId: string): Promise<AgentSession | undefined> => {
    return await db.sessions.get(sessionId);
  }, []);

  const getAllSessions = useCallback(async (): Promise<AgentSession[]> => {
    return await db.sessions.orderBy('startedAt').reverse().toArray();
  }, []);

  const updateSessionStatus = useCallback(async (sessionId: string, status: 'running' | 'stopped', endedAt?: number) => {
    await db.sessions.update(sessionId, { status, endedAt });
  }, []);

  // Output log operations
  const saveOutputLog = useCallback(async (sessionId: string, log: OutputLog) => {
    await db.outputLogs.put({ ...log, sessionId });
  }, []);

  const getOutputLogs = useCallback(async (sessionId: string): Promise<OutputLog[]> => {
    const logs = await db.outputLogs.where('sessionId').equals(sessionId).toArray();
    return logs.map(({ sessionId: _, ...log }) => log);
  }, []);

  // Change operations
  const saveChange = useCallback(async (change: Change) => {
    await db.changes.put(change);
  }, []);

  const getChange = useCallback(async (changeId: string): Promise<Change | undefined> => {
    return await db.changes.get(changeId);
  }, []);

  const getChangesBySession = useCallback(async (sessionId: string): Promise<Change[]> => {
    return await db.changes.where('sessionId').equals(sessionId).toArray();
  }, []);

  const updateChangeStatus = useCallback(async (changeId: string, status: Change['status']) => {
    await db.changes.update(changeId, { status });
  }, []);

  const getAllChanges = useCallback(async (): Promise<Change[]> => {
    return await db.changes.orderBy('timestamp').reverse().toArray();
  }, []);

  // Clear all data (for development/testing)
  const clearAll = useCallback(async () => {
    await db.sessions.clear();
    await db.outputLogs.clear();
    await db.changes.clear();
  }, []);

  return {
    saveSession,
    getSession,
    getAllSessions,
    updateSessionStatus,
    saveOutputLog,
    getOutputLogs,
    saveChange,
    getChange,
    getChangesBySession,
    updateChangeStatus,
    getAllChanges,
    clearAll,
  };
}
