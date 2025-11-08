import { query, type Query, type SDKMessage, type SDKUserMessage, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { Agent, EditPermissionRequest } from './types';
import { OutputBuffer } from './output-buffer';

export interface ClaudeControllerSDKCallbacks {
  onOutput: (agentId: string, sessionId: string, output: string, type: 'stdout' | 'stderr') => void;
  onExit: (agentId: string, sessionId: string, code: number | null) => void;
  onEditPermissionRequest?: (request: EditPermissionRequest) => void;
}

interface PendingApproval {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface ActiveAgent {
  query: Query;
  abortController: AbortController;
  messageQueue: SDKUserMessage[];
  messageResolve?: () => void;
}

export class ClaudeControllerSDK {
  private callbacks: ClaudeControllerSDKCallbacks;
  private outputBuffers: Map<string, OutputBuffer> = new Map();
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private activeAgents: Map<string, ActiveAgent> = new Map();

  constructor(callbacks: ClaudeControllerSDKCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start a Claude Agent using SDK
   */
  async startClaude(agent: Omit<Agent, 'process' | 'outputBuffer'>): Promise<Agent> {
    console.log(`[ClaudeControllerSDK] Starting Claude agent for ${agent.name} in ${agent.workDir}`);

    const outputBuffer = new OutputBuffer(1000);
    this.outputBuffers.set(agent.id, outputBuffer);

    const abortController = new AbortController();

    // 初期メッセージ
    const initialMessage = `You are ${agent.name}, a ${agent.role} agent. Your working directory is ${agent.workDir}. Please introduce yourself and wait for instructions.`;

    // SDK query()を非同期で実行
    this.runAgentQuery(agent, initialMessage, abortController);

    return {
      ...agent,
      process: null as any, // SDK版ではprocessは使わない
      outputBuffer: outputBuffer.getAll()
    };
  }

  /**
   * 継続的な会話を可能にするAsyncGenerator
   */
  private async *createMessageStream(
    agentId: string,
    initialMessage: string
  ): AsyncGenerator<SDKUserMessage> {
    const activeAgent = this.activeAgents.get(agentId);
    if (!activeAgent) {
      console.error(`[ClaudeControllerSDK] Active agent not found: ${agentId}`);
      return;
    }

    console.log(`[ClaudeControllerSDK] MessageStream: Starting for ${agentId}`);

    // 初期メッセージを送信
    console.log(`[ClaudeControllerSDK] MessageStream: Yielding initial message`);
    yield {
      type: 'user',
      message: {
        role: 'user',
        content: initialMessage
      },
      parent_tool_use_id: null,
      session_id: agentId
    };

    console.log(`[ClaudeControllerSDK] MessageStream: Initial message yielded, entering wait loop`);

    // 追加メッセージを待機
    while (true) {
      // メッセージキューが空の場合は待機
      if (activeAgent.messageQueue.length === 0) {
        console.log(`[ClaudeControllerSDK] MessageStream: Queue empty, waiting for messages...`);
        await new Promise<void>((resolve) => {
          activeAgent.messageResolve = resolve;
        });
        console.log(`[ClaudeControllerSDK] MessageStream: Wait resolved, checking queue`);
      }

      // キューからメッセージを取り出して送信
      while (activeAgent.messageQueue.length > 0) {
        const message = activeAgent.messageQueue.shift()!;
        console.log(`[ClaudeControllerSDK] MessageStream: Yielding queued message`);
        yield message;
      }
    }
  }

  /**
   * SDK query()を実行（非同期）
   */
  private async runAgentQuery(
    agent: Omit<Agent, 'process' | 'outputBuffer'>,
    initialMessage: string,
    abortController: AbortController
  ) {
    try {
      const outputBuffer = this.outputBuffers.get(agent.id)!;

      // ActiveAgentを先に作成（messageStreamで使用するため）
      const activeAgentData: ActiveAgent = {
        query: null as any,
        abortController,
        messageQueue: [],
        messageResolve: undefined
      };
      this.activeAgents.set(agent.id, activeAgentData);

      // SDK query()を実行
      const agentQuery = query({
        prompt: this.createMessageStream(agent.id, initialMessage),
        options: {
          cwd: agent.workDir,
          abortController,
          model: 'claude-sonnet-4-5',
          canUseTool: async (toolName: string, input: Record<string, unknown>, options): Promise<PermissionResult> => {
            console.log(`[ClaudeControllerSDK] canUseTool called: ${toolName}, toolUseID: ${options.toolUseID}`);

            // Edit toolの場合は承認待機
            if (toolName === 'Edit' && this.callbacks.onEditPermissionRequest) {
              const toolUseId = options.toolUseID;

              const editRequest: EditPermissionRequest = {
                agentId: agent.id,
                sessionId: agent.sessionId,
                filePath: String(input.file_path || ''),
                oldString: String(input.old_string || ''),
                newString: String(input.new_string || ''),
                toolUseId,
              };

              console.log(`[ClaudeControllerSDK] Edit permission request for ${input.file_path}`);
              this.callbacks.onEditPermissionRequest(editRequest);

              // 承認を待機
              try {
                const approved = await this.waitForApproval(toolUseId, 300000); // 5分タイムアウト

                if (approved) {
                  console.log(`[ClaudeControllerSDK] Edit approved for ${input.file_path}`);
                  return { behavior: 'allow', updatedInput: input };
                } else {
                  console.log(`[ClaudeControllerSDK] Edit rejected for ${input.file_path}`);
                  return {
                    behavior: 'deny',
                    message: 'User denied permission for this edit',
                    interrupt: false,
                  };
                }
              } catch (error: any) {
                console.error(`[ClaudeControllerSDK] Approval error:`, error);
                return {
                  behavior: 'deny',
                  message: `Approval timeout: ${error.message}`,
                  interrupt: false,
                };
              }
            }

            // その他のツールは自動承認
            return { behavior: 'allow', updatedInput: input };
          },
        },
      });

      // Queryを更新
      activeAgentData.query = agentQuery;

      // メッセージをストリーミング処理
      console.log(`[ClaudeControllerSDK] Starting to consume query stream for ${agent.name}`);
      for await (const message of agentQuery) {
        console.log(`[ClaudeControllerSDK] Received message type: ${message.type}`);
        this.handleSDKMessage(agent, message, outputBuffer);
      }

      console.log(`[ClaudeControllerSDK] Agent ${agent.name} query stream ended - loop exited`);
      this.callbacks.onExit(agent.id, agent.sessionId, 0);
    } catch (error: any) {
      console.error(`[ClaudeControllerSDK] Agent ${agent.name} error:`, error);

      const errorMessage = `[ERROR] ${error.message}`;
      const outputBuffer = this.outputBuffers.get(agent.id);
      if (outputBuffer) {
        outputBuffer.push(errorMessage);
      }
      this.callbacks.onOutput(agent.id, agent.sessionId, errorMessage, 'stderr');
      this.callbacks.onExit(agent.id, agent.sessionId, 1);
    } finally {
      this.activeAgents.delete(agent.id);
    }
  }

  /**
   * SDKメッセージを処理
   */
  private handleSDKMessage(
    agent: Omit<Agent, 'process' | 'outputBuffer'>,
    message: SDKMessage,
    outputBuffer: OutputBuffer
  ) {
    // アシスタントメッセージ
    if (message.type === 'assistant') {
      const content = message.message.content;
      for (const block of content) {
        if (block.type === 'text') {
          outputBuffer.push(block.text);
          this.callbacks.onOutput(agent.id, agent.sessionId, block.text, 'stdout');
        } else if (block.type === 'tool_use') {
          // ツール使用の表示
          let activityMessage = `🔧 ${block.name}`;
          if (block.name === 'Read') {
            activityMessage += ` 📖 ${(block.input as any).file_path || ''}`;
          } else if (block.name === 'Write') {
            activityMessage += ` ✍️ ${(block.input as any).file_path || ''}`;
          } else if (block.name === 'Edit') {
            activityMessage += ` ✏️ ${(block.input as any).file_path || ''}`;
          } else if (block.name === 'Bash') {
            activityMessage += ` 💻 ${(block.input as any).command?.substring(0, 50) || ''}`;
          } else if (block.name === 'Grep') {
            activityMessage += ` 🔍 "${(block.input as any).pattern || ''}"`;
          } else if (block.name === 'Glob') {
            activityMessage += ` 📂 "${(block.input as any).pattern || ''}"`;
          }

          outputBuffer.push(activityMessage);
          this.callbacks.onOutput(agent.id, agent.sessionId, activityMessage, 'stdout');
        }
      }
    }
    // ストリームイベント
    else if (message.type === 'stream_event') {
      const event = message.event;
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        outputBuffer.push(text);
        this.callbacks.onOutput(agent.id, agent.sessionId, text, 'stdout');
      }
    }
    // 結果メッセージ
    else if (message.type === 'result') {
      const resultMsg = message.subtype === 'success'
        ? `✅ Task completed (${message.num_turns} turns)`
        : `❌ Error: ${message.subtype}`;

      outputBuffer.push(resultMsg);
      this.callbacks.onOutput(agent.id, agent.sessionId, resultMsg, 'stdout');

      // 権限拒否があった場合
      if (message.permission_denials && message.permission_denials.length > 0) {
        const denials = message.permission_denials.map(d => `${d.tool_name} (${d.tool_use_id})`).join(', ');
        const denialMsg = `⚠️ Permission denials: ${denials}`;
        outputBuffer.push(denialMsg);
        this.callbacks.onOutput(agent.id, agent.sessionId, denialMsg, 'stdout');
      }
    }
    // システムメッセージ
    else if (message.type === 'system') {
      if (message.subtype === 'init') {
        const initMsg = `🚀 Claude ${message.claude_code_version} initialized (${message.model})`;
        outputBuffer.push(initMsg);
        this.callbacks.onOutput(agent.id, agent.sessionId, initMsg, 'stdout');
      }
    }
  }

  /**
   * 承認を待機
   */
  private waitForApproval(toolUseId: string, timeout: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingApprovals.delete(toolUseId);
        reject(new Error('Approval timeout'));
      }, timeout);

      this.pendingApprovals.set(toolUseId, {
        resolve: (approved: boolean) => {
          clearTimeout(timeoutId);
          resolve(approved);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * 承認を送信
   */
  approveEdit(toolUseId: string): boolean {
    const pending = this.pendingApprovals.get(toolUseId);
    if (!pending) {
      console.error(`[ClaudeControllerSDK] No pending approval for ${toolUseId}`);
      return false;
    }

    pending.resolve(true);
    this.pendingApprovals.delete(toolUseId);
    return true;
  }

  /**
   * 拒否を送信
   */
  rejectEdit(toolUseId: string): boolean {
    const pending = this.pendingApprovals.get(toolUseId);
    if (!pending) {
      console.error(`[ClaudeControllerSDK] No pending approval for ${toolUseId}`);
      return false;
    }

    pending.resolve(false);
    this.pendingApprovals.delete(toolUseId);
    return true;
  }

  /**
   * メッセージ送信
   */
  sendInput(agentId: string, input: string): void {
    console.log(`[ClaudeControllerSDK] sendInput called for ${agentId}: "${input.substring(0, 50)}..."`);
    const activeAgent = this.activeAgents.get(agentId);
    if (!activeAgent) {
      console.error(`[ClaudeControllerSDK] Agent ${agentId} not found`);
      return;
    }

    // メッセージをキューに追加
    activeAgent.messageQueue.push({
      type: 'user',
      message: {
        role: 'user',
        content: input
      },
      parent_tool_use_id: null,
      session_id: agentId
    });
    console.log(`[ClaudeControllerSDK] Message added to queue. Queue length: ${activeAgent.messageQueue.length}`);

    // 待機中のPromiseがあればresolve
    if (activeAgent.messageResolve) {
      console.log(`[ClaudeControllerSDK] Resolving waiting promise`);
      activeAgent.messageResolve();
      activeAgent.messageResolve = undefined;
    } else {
      console.log(`[ClaudeControllerSDK] No waiting promise to resolve`);
    }
  }

  /**
   * Get output buffer for an agent
   */
  getOutputBuffer(agentId: string): string[] {
    const buffer = this.outputBuffers.get(agentId);
    return buffer ? buffer.getAll() : [];
  }

  /**
   * Interrupt the current operation (abort without cleanup)
   */
  interruptAgent(agentId: string): boolean {
    const activeAgent = this.activeAgents.get(agentId);
    if (!activeAgent) {
      console.error(`[ClaudeControllerSDK] Cannot interrupt: Agent ${agentId} not found`);
      return false;
    }

    console.log(`[ClaudeControllerSDK] Interrupting agent ${agentId}`);
    activeAgent.abortController.abort();
    return true;
  }

  /**
   * Stop a Claude Agent
   */
  stopClaude(agentId: string): void {
    const activeAgent = this.activeAgents.get(agentId);
    if (activeAgent) {
      activeAgent.abortController.abort();
      this.activeAgents.delete(agentId);
    }

    // Clean up output buffer
    this.outputBuffers.delete(agentId);

    // Clean up pending approvals
    for (const [toolUseId, pending] of this.pendingApprovals.entries()) {
      if (toolUseId.startsWith(agentId)) {
        pending.reject(new Error('Agent stopped'));
        this.pendingApprovals.delete(toolUseId);
      }
    }
  }
}
