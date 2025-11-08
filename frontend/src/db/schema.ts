import Dexie, { Table } from 'dexie';
import { AgentSession, OutputLog, Change } from '../types';

export class MultiAgentDB extends Dexie {
  sessions!: Table<AgentSession, string>;
  outputLogs!: Table<OutputLog & { sessionId: string }, [string, number]>;
  changes!: Table<Change, string>;

  constructor() {
    super('multi-agent-dev');

    this.version(1).stores({
      sessions: 'id, agentName, startedAt, status',
      outputLogs: '[sessionId+timestamp], sessionId',
      changes: 'id, sessionId, status'
    });
  }
}

export const db = new MultiAgentDB();
