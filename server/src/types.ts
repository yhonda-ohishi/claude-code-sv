import { ChildProcess } from 'child_process';

export interface Agent {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  process: ChildProcess;
  workDir: string;
  patterns: string[];
  status: 'running' | 'stopped';
  startedAt: number;
  outputBuffer: string[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Command {
  id: string;
  agentId: string;
  command: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: number;
  exitCode?: number;
}

export interface Change {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  filePath: string;
  before: string;
  after: string;
  status: 'pending' | 'accepted' | 'declined' | 'processing';
  timestamp: number;
  instruction?: string;
}

export interface AgentSession {
  id: string;
  agentName: string;
  role: string;
  workDir: string;
  patterns: string[];
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'stopped';
  conversationHistory: Message[];
  outputLogs: OutputLog[];
  changes: string[];
}

export interface OutputLog {
  timestamp: number;
  output: string;
  type: 'stdout' | 'stderr';
}

export interface StartAgentRequest {
  name: string;
  role: string;
  workDir: string;
  patterns: string[];
  sessionId?: string;
}

export interface StartAgentResponse {
  agentId: string;
  sessionId: string;
  status: string;
}

export interface StopAgentRequest {
  agentId: string;
}

export interface WebSocketMessage {
  type: 'subscribe' | 'agent_started' | 'agent_stopped' | 'new_change' | 'status_update' | 'agent_output' | 'command_output' | 'command_completed';
  data?: any;
}
