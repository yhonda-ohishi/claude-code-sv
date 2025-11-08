import { Agent, Change, StartAgentRequest, EditPermissionRequest } from './types';
import { ClaudeController, ClaudeControllerCallbacks } from './claude-controller';
import { ClaudeControllerSDK, ClaudeControllerSDKCallbacks } from './claude-controller-sdk';
import { ChangeParser } from './change-parser';
import { PersistenceManager, PersistedAgent } from './persistence';

export interface AgentManagerCallbacks {
  onAgentStarted: (agent: Agent) => void;
  onAgentStopped: (agentId: string, sessionId: string) => void;
  onAgentOutput: (agentId: string, sessionId: string, output: string, type: 'stdout' | 'stderr') => void;
  onNewChange: (change: Change) => void;
  onEditPermissionRequest: (request: EditPermissionRequest) => void;
}

export class AgentManager {
  private agents: Map<string, Agent> = new Map();
  private changes: Map<string, Change> = new Map();
  private claudeController: ClaudeController;
  private claudeControllerSDK: ClaudeControllerSDK;
  private changeParser: ChangeParser;
  private callbacks: AgentManagerCallbacks;
  private persistence: PersistenceManager;
  private useSDK: boolean = true; // SDK版をテスト

  constructor(callbacks: AgentManagerCallbacks) {
    this.callbacks = callbacks;
    this.changeParser = new ChangeParser();
    this.persistence = new PersistenceManager();

    const controllerCallbacks: ClaudeControllerCallbacks = {
      onOutput: (agentId, sessionId, output, type) => {
        this.handleAgentOutput(agentId, sessionId, output, type);
      },
      onExit: (agentId, sessionId, code) => {
        this.handleAgentExit(agentId, sessionId, code);
      },
      onEditPermissionRequest: (request) => {
        this.callbacks.onEditPermissionRequest(request);
      }
    };

    const sdkCallbacks: ClaudeControllerSDKCallbacks = {
      onOutput: (agentId, sessionId, output, type) => {
        this.handleAgentOutput(agentId, sessionId, output, type);
      },
      onExit: (agentId, sessionId, code) => {
        this.handleAgentExit(agentId, sessionId, code);
      },
      onEditPermissionRequest: (request) => {
        this.callbacks.onEditPermissionRequest(request);
      }
    };

    this.claudeController = new ClaudeController(controllerCallbacks);
    this.claudeControllerSDK = new ClaudeControllerSDK(sdkCallbacks);
  }

  /**
   * Initialize by loading persisted agents
   */
  async initialize(): Promise<void> {
    console.log('[AgentManager] Initializing...');

    // Load persisted agents
    const persistedAgents = await this.persistence.loadAgents();
    console.log(`[AgentManager] Found ${persistedAgents.length} persisted agents`);

    const removedAgents: PersistedAgent[] = [];
    const restoredAgents: PersistedAgent[] = [];

    for (const persistedAgent of persistedAgents) {
      // Check if process is still running
      const isRunning = this.persistence.isProcessRunning(persistedAgent.pid);
      console.log(`[AgentManager] Agent ${persistedAgent.name} (PID: ${persistedAgent.pid}): ${isRunning ? 'RUNNING' : 'NOT RUNNING'}`);

      if (!isRunning) {
        // Process is dead - add as stopped agent without auto-restarting
        console.log(`[AgentManager] Process dead for agent ${persistedAgent.name}, adding as stopped`);

        // Create a dummy agent entry with stopped status
        const stoppedAgent: Agent = {
          id: persistedAgent.id,
          sessionId: persistedAgent.sessionId,
          name: persistedAgent.name,
          role: persistedAgent.role,
          workDir: persistedAgent.workDir,
          patterns: persistedAgent.patterns,
          status: 'stopped' as const,
          startedAt: persistedAgent.startedAt,
          process: null as any, // No process for stopped agents
          outputBuffer: []
        };

        this.agents.set(persistedAgent.id, stoppedAgent);
        continue;
      }

      // Process is still running - attempt to kill and mark as stopped
      console.log(`[AgentManager] Process still running for agent ${persistedAgent.name} (PID: ${persistedAgent.pid}), killing...`);
      try {
        if (persistedAgent.pid !== undefined) {
          process.kill(persistedAgent.pid, 'SIGTERM');
          console.log(`[AgentManager] Killed orphaned process ${persistedAgent.pid}`);
        }
      } catch (e) {
        console.log(`[AgentManager] Could not kill process ${persistedAgent.pid} (may already be dead)`);
      }

      // Add as stopped agent
      const stoppedAgent: Agent = {
        id: persistedAgent.id,
        sessionId: persistedAgent.sessionId,
        name: persistedAgent.name,
        role: persistedAgent.role,
        workDir: persistedAgent.workDir,
        patterns: persistedAgent.patterns,
        status: 'stopped' as const,
        startedAt: persistedAgent.startedAt,
        process: null as any,
        outputBuffer: []
      };

      this.agents.set(persistedAgent.id, stoppedAgent);
    }

    // Log summary
    if (restoredAgents.length > 0) {
      console.log(`\n[AgentManager] ==================== RESTORED AGENTS ====================`);
      restoredAgents.forEach(agent => {
        const restoredAgent = this.agents.get(agent.id);
        console.log(`  - ${agent.name} (ID: ${agent.id})`);
        console.log(`    Old PID: ${agent.pid} -> New PID: ${restoredAgent?.process.pid || 'N/A'}`);
        console.log(`    Started: ${new Date(agent.startedAt).toLocaleString()}`);
        console.log(`    WorkDir: ${agent.workDir}`);
      });
      console.log(`[AgentManager] ====================================================\n`);
    }

    if (removedAgents.length > 0) {
      console.log(`\n[AgentManager] ==================== REMOVED AGENTS ====================`);
      removedAgents.forEach(agent => {
        console.log(`  - ${agent.name} (ID: ${agent.id}, PID: ${agent.pid})`);
        console.log(`    Started: ${new Date(agent.startedAt).toLocaleString()}`);
        console.log(`    WorkDir: ${agent.workDir}`);
      });
      console.log(`[AgentManager] ====================================================\n`);
    }

    // Load persisted changes
    const persistedChanges = await this.persistence.loadChanges();
    console.log(`[AgentManager] Loaded ${persistedChanges.length} persisted changes`);

    for (const change of persistedChanges) {
      this.changes.set(change.id, change);
    }

    console.log('[AgentManager] Initialization complete');
  }

  /**
   * Persist current state
   */
  private async persistState(): Promise<void> {
    const agents = Array.from(this.agents.values());
    await this.persistence.saveAgents(agents);

    const changes = Array.from(this.changes.values());
    await this.persistence.saveChanges(changes);
  }

  /**
   * Start a new agent
   */
  async startAgent(request: StartAgentRequest): Promise<Agent> {
    const sessionId = request.sessionId || this.generateSessionId(request.name);
    const agentId = this.generateAgentId();

    const agentConfig = {
      id: agentId,
      sessionId,
      name: request.name,
      role: request.role,
      workDir: request.workDir,
      patterns: request.patterns,
      status: 'running' as const,
      startedAt: Date.now()
    };

    const agent = this.useSDK
      ? await this.claudeControllerSDK.startClaude(agentConfig)
      : this.claudeController.startClaude(agentConfig);

    this.agents.set(agentId, agent);

    this.callbacks.onAgentStarted(agent);

    // Persist state
    this.persistState();

    return agent;
  }

  /**
   * Stop an agent
   */
  stopAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Stop using appropriate controller
    if (agent.status === 'running') {
      if (this.useSDK) {
        this.claudeControllerSDK.stopClaude(agentId);
      } else if (agent.process) {
        this.claudeController.stopClaude(agent.process, agentId);
      }
    }

    // Update status to stopped
    agent.status = 'stopped';
    agent.process = null as any; // Clear process reference

    // Keep agent in map but with stopped status
    this.agents.set(agentId, agent);

    // Persist state
    this.persistState();

    return true;
  }

  /**
   * Delete an agent
   */
  deleteAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Stop the process if it's running
    if (agent.process && agent.status === 'running') {
      this.claudeController.stopClaude(agent.process, agentId);
    }

    // Remove from map
    this.agents.delete(agentId);

    // Persist state
    this.persistState();

    console.log(`[AgentManager] Deleted agent ${agent.name} (${agentId})`);
    return true;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Accept a change
   */
  acceptChange(changeId: string): boolean {
    const change = this.changes.get(changeId);
    if (!change || change.status !== 'pending') {
      return false;
    }

    const agent = this.agents.get(change.agentId);
    if (!agent) {
      return false;
    }

    change.status = 'accepted';
    // CLI版では toolUseId が必要（change から取得する必要がある場合は追加）
    this.claudeController.acceptChange(agent.process, changeId);

    return true;
  }

  /**
   * Decline a change
   */
  declineChange(changeId: string): boolean {
    const change = this.changes.get(changeId);
    if (!change || change.status !== 'pending') {
      return false;
    }

    const agent = this.agents.get(change.agentId);
    if (!agent) {
      return false;
    }

    change.status = 'declined';
    // CLI版では toolUseId が必要（change から取得する必要がある場合は追加）
    this.claudeController.declineChange(agent.process, changeId);

    return true;
  }

  /**
   * Send additional instruction for a change
   */
  sendInstruction(changeId: string, instruction: string): boolean {
    const change = this.changes.get(changeId);
    if (!change || change.status !== 'pending') {
      return false;
    }

    const agent = this.agents.get(change.agentId);
    if (!agent) {
      return false;
    }

    change.instruction = instruction;
    this.claudeController.sendInstruction(agent.process, instruction);

    return true;
  }

  /**
   * Get agent output buffer
   */
  getAgentOutput(agentId: string): string[] {
    // Get output from ClaudeController's buffer
    return this.claudeController.getOutputBuffer(agentId);
  }

  /**
   * Send message to agent
   */
  sendMessageToAgent(agentId: string, message: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'running') {
      return false;
    }

    try {
      // SDK版とCLI版で処理を分岐
      if (this.useSDK) {
        this.claudeControllerSDK.sendInput(agentId, message);
      } else {
        this.claudeController.sendInput(agent.process, message);
      }
      console.log(`Message sent to agent ${agentId}:`, message);
      return true;
    } catch (error) {
      console.error(`Failed to send message to agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Approve edit permission request
   */
  approveEdit(agentId: string, toolUseId: string): boolean {
    console.log(`\n========== EDIT APPROVAL REQUEST ==========`);
    console.log(`Agent ID: ${agentId}`);
    console.log(`Tool Use ID: ${toolUseId}`);
    console.log(`Using SDK: ${this.useSDK}`);

    const agent = this.agents.get(agentId);
    if (!agent) {
      console.error(`[AgentManager] ❌ Agent ${agentId} NOT FOUND`);
      console.log(`==========================================\n`);
      return false;
    }

    console.log(`Agent status: ${agent.status}`);
    console.log(`Agent name: ${agent.name}`);

    if (agent.status !== 'running') {
      console.error(`[AgentManager] ❌ Agent ${agentId} is not running (status: ${agent.status})`);
      console.log(`==========================================\n`);
      return false;
    }

    try {
      console.log(`[AgentManager] ✅ Sending approval...`);
      const success = this.useSDK
        ? this.claudeControllerSDK.approveEdit(toolUseId)
        : (this.claudeController.acceptChange(agent.process, toolUseId), true);

      console.log(`[AgentManager] ✅ Approval sent successfully`);
      console.log(`==========================================\n`);
      return success;
    } catch (error) {
      console.error(`[AgentManager] ❌ Failed to approve edit:`, error);
      console.log(`==========================================\n`);
      return false;
    }
  }

  /**
   * Reject edit permission request
   */
  rejectEdit(agentId: string, toolUseId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== 'running') {
      console.error(`[AgentManager] Cannot reject edit: agent ${agentId} not running`);
      return false;
    }

    try {
      console.log(`[AgentManager] Rejecting edit for agent ${agentId}, toolUseId: ${toolUseId}`);
      const success = this.useSDK
        ? this.claudeControllerSDK.rejectEdit(toolUseId)
        : (this.claudeController.declineChange(agent.process, toolUseId), true);

      return success;
    } catch (error) {
      console.error(`Failed to reject edit for agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Handle agent output
   */
  private handleAgentOutput(agentId: string, sessionId: string, output: string, type: 'stdout' | 'stderr'): void {
    // Notify callbacks
    this.callbacks.onAgentOutput(agentId, sessionId, output, type);

    // Check for change proposals
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const change = this.changeParser.parseChangeProposal(output, agentId, agent.name, sessionId);
    if (change) {
      this.changes.set(change.id, change);
      this.callbacks.onNewChange(change);

      // Persist changes
      this.persistState();
    }
  }

  /**
   * Handle agent exit
   */
  private handleAgentExit(agentId: string, sessionId: string, code: number | null): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const uptime = Date.now() - agent.startedAt;
    console.log(`[AgentManager] Agent ${agent.name} exited after ${uptime}ms with code ${code}`);

    // If process crashed within 5 seconds, log error
    if (uptime < 5000 && code !== 0) {
      console.error(`[AgentManager] Agent ${agent.name} crashed immediately (code ${code})`);
      console.error(`[AgentManager] WorkDir: ${agent.workDir}`);
      console.error(`[AgentManager] This might indicate Claude Code is not installed or not in PATH`);
    }

    agent.status = 'stopped';
    this.callbacks.onAgentStopped(agentId, sessionId);

    // Persist state
    this.persistState();
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(agentName: string): string {
    const timestamp = Date.now();
    return `session-${agentName.toLowerCase()}-${timestamp}`;
  }

  /**
   * Get all changes
   */
  getAllChanges(): Change[] {
    return Array.from(this.changes.values());
  }

  /**
   * Get change by ID
   */
  getChange(changeId: string): Change | undefined {
    return this.changes.get(changeId);
  }
}
