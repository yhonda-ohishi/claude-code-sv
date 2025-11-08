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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Agent {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  status: 'running' | 'stopped';
  startedAt: number;
  workDir: string;
  patterns: string[];
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

export interface Command {
  id: string;
  agentId: string;
  command: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: number;
  exitCode?: number;
}

export interface EditPermissionRequest {
  agentId: string;
  sessionId: string;
  filePath: string;
  oldString: string;
  newString: string;
  toolUseId: string;
}

// WebSocket message types
export type WSMessage =
  | { type: 'subscribe' }
  | { type: 'agent_started'; data: Agent }
  | { type: 'agent_stopped'; data: { agentId: string; sessionId: string } }
  | { type: 'new_change'; data: Change }
  | { type: 'status_update'; data: { changeId: string; status: Change['status'] } }
  | { type: 'agent_output'; data: { agentId: string; sessionId: string; output: string; timestamp: number } }
  | { type: 'command_output'; data: { commandId: string; output: string; status: Command['status'] } }
  | { type: 'command_completed'; data: { commandId: string; exitCode: number; status: Command['status'] } }
  | { type: 'edit_permission_request'; data: EditPermissionRequest };

// API request/response types
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

export interface ExecuteCommandRequest {
  command: string;
}

export interface InstructionRequest {
  instruction: string;
}
