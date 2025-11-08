import * as fs from 'fs/promises';
import * as path from 'path';
import { Agent } from './types';

const AGENTS_FILE = path.join(process.cwd(), 'data', 'agents.json');
const CHANGES_FILE = path.join(process.cwd(), 'data', 'changes.json');

export interface PersistedAgent {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  workDir: string;
  patterns: string[];
  status: 'running' | 'stopped';
  startedAt: number;
  pid?: number;
}

export class PersistenceManager {
  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(AGENTS_FILE);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  /**
   * Save agents to JSON file
   */
  async saveAgents(agents: Agent[]): Promise<void> {
    try {
      const persistedAgents: PersistedAgent[] = agents.map(agent => ({
        id: agent.id,
        sessionId: agent.sessionId,
        name: agent.name,
        role: agent.role,
        workDir: agent.workDir,
        patterns: agent.patterns,
        status: agent.status,
        startedAt: agent.startedAt,
        pid: agent.process?.pid,
      }));

      await fs.writeFile(AGENTS_FILE, JSON.stringify(persistedAgents, null, 2), 'utf8');
      console.log(`[Persistence] Saved ${persistedAgents.length} agents to ${AGENTS_FILE}`);
    } catch (error) {
      console.error('[Persistence] Failed to save agents:', error);
    }
  }

  /**
   * Load agents from JSON file
   */
  async loadAgents(): Promise<PersistedAgent[]> {
    try {
      const data = await fs.readFile(AGENTS_FILE, 'utf8');
      const agents = JSON.parse(data) as PersistedAgent[];
      console.log(`[Persistence] Loaded ${agents.length} agents from ${AGENTS_FILE}`);
      return agents;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('[Persistence] No existing agents file found');
        return [];
      }
      console.error('[Persistence] Failed to load agents:', error);
      return [];
    }
  }

  /**
   * Check if a process is still running
   */
  isProcessRunning(pid: number | undefined): boolean {
    if (!pid) return false;

    try {
      // Send signal 0 to check if process exists without killing it
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save changes to JSON file
   */
  async saveChanges(changes: any[]): Promise<void> {
    try {
      await fs.writeFile(CHANGES_FILE, JSON.stringify(changes, null, 2), 'utf8');
      console.log(`[Persistence] Saved ${changes.length} changes to ${CHANGES_FILE}`);
    } catch (error) {
      console.error('[Persistence] Failed to save changes:', error);
    }
  }

  /**
   * Load changes from JSON file
   */
  async loadChanges(): Promise<any[]> {
    try {
      const data = await fs.readFile(CHANGES_FILE, 'utf8');
      const changes = JSON.parse(data);
      console.log(`[Persistence] Loaded ${changes.length} changes from ${CHANGES_FILE}`);
      return changes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('[Persistence] No existing changes file found');
        return [];
      }
      console.error('[Persistence] Failed to load changes:', error);
      return [];
    }
  }
}
