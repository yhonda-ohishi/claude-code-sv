import { spawn, ChildProcess } from 'child_process';
import { Agent, EditPermissionRequest } from './types';
import { OutputBuffer } from './output-buffer';

export interface ClaudeControllerCallbacks {
  onOutput: (agentId: string, sessionId: string, output: string, type: 'stdout' | 'stderr') => void;
  onExit: (agentId: string, sessionId: string, code: number | null) => void;
  onEditPermissionRequest?: (request: EditPermissionRequest) => void;
}

export class ClaudeController {
  private callbacks: ClaudeControllerCallbacks;
  private outputBuffers: Map<string, OutputBuffer> = new Map();

  constructor(callbacks: ClaudeControllerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start a Claude Code process
   */
  startClaude(agent: Omit<Agent, 'process' | 'outputBuffer'>): Agent {
    console.log(`[ClaudeController] Starting Claude process for agent ${agent.name} in ${agent.workDir}`);

    // Find Claude executable path
    const claudePath = process.platform === 'win32'
      ? process.env.CLAUDE_PATH || 'claude.exe'
      : 'claude';

    // Start Claude in stream-json mode for programmatic interaction
    const proc = spawn(claudePath, [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json'
    ], {
      cwd: agent.workDir,
      env: {
        ...process.env,
        AGENT_ID: agent.id,
        AGENT_NAME: agent.name,
        AGENT_ROLE: agent.role,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      detached: false  // Keep attached to parent
    });

    console.log(`[ClaudeController] Process spawned with PID: ${proc.pid}`);
    console.log(`[ClaudeController] Process stdin:`, proc.stdin !== null);
    console.log(`[ClaudeController] Process stdout:`, proc.stdout !== null);
    console.log(`[ClaudeController] Process stderr:`, proc.stderr !== null);

    const outputBuffer = new OutputBuffer(1000);
    this.outputBuffers.set(agent.id, outputBuffer);

    // Setup stdout handler
    if (proc.stdout) {
      console.log(`[ClaudeController] Setting up stdout handler for agent ${agent.name}`);

      // Set encoding to utf8 and disable buffering
      proc.stdout.setEncoding('utf8');

      proc.stdout.on('data', (data: string) => {
        console.log(`[${agent.name}] stdout DATA EVENT FIRED! Length: ${data.length}`);
        console.log(`[${agent.name}] stdout content:`, data.substring(0, 500));

        // Parse stream-json output and filter relevant messages
        try {
          const lines = data.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);

              // Log all messages for debugging
              console.log(`[${agent.name}] Message type: ${parsed.type}${parsed.subtype ? `/${parsed.subtype}` : ''}`);

              // Extract and send only text content from assistant messages
              if (parsed.type === 'assistant' && parsed.message?.content) {
                // Extract text content from content array
                const textContent = parsed.message.content
                  .filter((item: any) => item.type === 'text')
                  .map((item: any) => item.text)
                  .join('\n');

                if (textContent) {
                  console.log(`[${agent.name}] >>> PUSHING TO BUFFER: "${textContent.substring(0, 100)}..."`);
                  console.log(`[${agent.name}] >>> Buffer size before push: ${outputBuffer.getAll().length}`);
                  outputBuffer.push(textContent);
                  console.log(`[${agent.name}] >>> Buffer size after push: ${outputBuffer.getAll().length}`);
                  console.log(`[${agent.name}] >>> Calling onOutput callback`);
                  this.callbacks.onOutput(agent.id, agent.sessionId, textContent, 'stdout');
                }

                // Check for tool use and show activity
                const toolUseItems = parsed.message.content.filter((item: any) => item.type === 'tool_use');
                console.log(`[${agent.name}] Found ${toolUseItems.length} tool_use items in assistant message`);
                for (const toolUse of toolUseItems) {
                  console.log(`[${agent.name}] Tool use detected: ${toolUse.name} (id: ${toolUse.id})`);

                  // Format and send tool activity message
                  let activityMessage = `🔧 ${toolUse.name}`;
                  if (toolUse.name === 'Read') {
                    activityMessage += ` 📖 ${toolUse.input.file_path}`;
                  } else if (toolUse.name === 'Write') {
                    activityMessage += ` ✍️ ${toolUse.input.file_path}`;
                  } else if (toolUse.name === 'Edit') {
                    activityMessage += ` ✏️ ${toolUse.input.file_path}`;
                  } else if (toolUse.name === 'Bash') {
                    activityMessage += ` 💻 ${toolUse.input.command?.substring(0, 50) || ''}`;
                  } else if (toolUse.name === 'Grep') {
                    activityMessage += ` 🔍 "${toolUse.input.pattern}"`;
                  } else if (toolUse.name === 'Glob') {
                    activityMessage += ` 📂 "${toolUse.input.pattern}"`;
                  } else if (toolUse.name === 'Task') {
                    activityMessage += ` 🤖 ${toolUse.input.description || ''}`;
                  }

                  outputBuffer.push(activityMessage);
                  this.callbacks.onOutput(agent.id, agent.sessionId, activityMessage, 'stdout');

                  // Check for Edit permission request
                  if (toolUse.name === 'Edit' && this.callbacks.onEditPermissionRequest) {
                    const editRequest: EditPermissionRequest = {
                      agentId: agent.id,
                      sessionId: agent.sessionId,
                      filePath: toolUse.input.file_path,
                      oldString: toolUse.input.old_string,
                      newString: toolUse.input.new_string,
                      toolUseId: toolUse.id,
                    };
                    console.log(`[${agent.name}] *** EDIT PERMISSION REQUEST DETECTED for ${editRequest.filePath} ***`);
                    this.callbacks.onEditPermissionRequest(editRequest);
                  }
                }
              }
              // Log internal messages but don't send to frontend (user, system, tool_result)
              else if (parsed.type === 'user' || parsed.type === 'system' || parsed.type === 'tool_result') {
                console.log(`[${agent.name}] Internal message (${parsed.type}):`, JSON.stringify(parsed).substring(0, 200));
              }
              // Unknown message types - log for debugging
              else {
                console.log(`[${agent.name}] Unknown message type: ${parsed.type}`);
              }
            } catch (parseError) {
              // If not valid JSON, it's likely just log output - don't send to chat
              console.log(`[${agent.name}] Non-JSON output (ignored):`, line.substring(0, 100));
            }
          }
        } catch (error) {
          // Fallback: send data as-is if parsing fails
          outputBuffer.push(data);
          this.callbacks.onOutput(agent.id, agent.sessionId, data, 'stdout');
        }
      });

      proc.stdout.on('end', () => {
        console.log(`[${agent.name}] stdout stream ended`);
      });

      proc.stdout.on('error', (error) => {
        console.error(`[${agent.name}] stdout error:`, error);
      });
    } else {
      console.warn(`[ClaudeController] WARNING: stdout is null for agent ${agent.name}`);
    }

    // Setup stderr handler
    if (proc.stderr) {
      console.log(`[ClaudeController] Setting up stderr handler for agent ${agent.name}`);
      proc.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log(`[${agent.name}] stderr (${output.length} bytes):`, output.substring(0, 200));
        outputBuffer.push(`[stderr] ${output}`);
        this.callbacks.onOutput(agent.id, agent.sessionId, `[stderr] ${output}`, 'stderr');
      });

      proc.stderr.on('end', () => {
        console.log(`[${agent.name}] stderr stream ended`);
      });

      proc.stderr.on('error', (error) => {
        console.error(`[${agent.name}] stderr error:`, error);
      });
    } else {
      console.warn(`[ClaudeController] WARNING: stderr is null for agent ${agent.name}`);
    }

    // Setup exit handler
    proc.on('exit', (code) => {
      console.log(`Agent ${agent.name} (${agent.id}) exited with code ${code}`);
      this.callbacks.onExit(agent.id, agent.sessionId, code);
    });

    // Setup error handler
    proc.on('error', (error) => {
      console.error(`Agent ${agent.name} (${agent.id}) process error:`, error);
      outputBuffer.push(`[error] ${error.message}`);
      this.callbacks.onOutput(agent.id, agent.sessionId, `[error] ${error.message}`, 'stderr');
    });

    // Send initial greeting message to start the interactive session (in stream-json format)
    setTimeout(() => {
      if (proc.stdin && !proc.killed) {
        const initialMessage = `You are ${agent.name}, a ${agent.role} agent. Your working directory is ${agent.workDir}. Please introduce yourself and wait for instructions.`;
        console.log(`[ClaudeController] Sending initial message to agent ${agent.name}:`, initialMessage);

        // Send in stream-json format
        const jsonMessage = JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: initialMessage
          }
        });
        proc.stdin.write(jsonMessage + '\n');
      }
    }, 1000); // Give Claude a moment to initialize

    return {
      ...agent,
      process: proc,
      outputBuffer: outputBuffer.getAll()
    };
  }

  /**
   * Send input to Claude Code process (Accept/Decline/Instruction) in stream-json format
   */
  sendInput(process: ChildProcess, input: string): void {
    if (process.stdin) {
      const jsonMessage = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: input
        }
      });
      process.stdin.write(jsonMessage + '\n');
    }
  }

  /**
   * Accept a change proposal (send 'y' as user message in stream-json format)
   */
  acceptChange(process: ChildProcess, toolUseId: string): void {
    console.log(`[ClaudeController] acceptChange called`);
    console.log(`[ClaudeController] Process PID: ${process.pid}`);
    console.log(`[ClaudeController] Tool Use ID: ${toolUseId}`);
    console.log(`[ClaudeController] Process killed: ${process.killed}`);
    console.log(`[ClaudeController] stdin exists: ${!!process.stdin}`);
    console.log(`[ClaudeController] stdin writable: ${process.stdin?.writable}`);

    // Send 'y' as a user message (approval for edit permission prompt)
    if (process.stdin) {
      const approvalMessage = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: 'y'
        }
      });
      console.log(`[ClaudeController] Sending approval message:`, approvalMessage);
      const result = process.stdin.write(approvalMessage + '\n');
      console.log(`[ClaudeController] Write result: ${result}`);
    } else {
      console.error(`[ClaudeController] ❌ stdin is null, cannot send approval`);
    }
  }

  /**
   * Decline a change proposal (send 'n' as user message in stream-json format)
   */
  declineChange(process: ChildProcess, toolUseId: string): void {
    console.log(`[ClaudeController] declineChange called for tool use: ${toolUseId}`);

    // Send 'n' as a user message (rejection for edit permission prompt)
    if (process.stdin) {
      const rejectionMessage = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: 'n'
        }
      });
      console.log(`[ClaudeController] Sending rejection message:`, rejectionMessage);
      process.stdin.write(rejectionMessage + '\n');
    }
  }

  /**
   * Send additional instruction
   */
  sendInstruction(process: ChildProcess, instruction: string): void {
    this.sendInput(process, instruction);
  }

  /**
   * Get output buffer for an agent
   */
  getOutputBuffer(agentId: string): string[] {
    const buffer = this.outputBuffers.get(agentId);
    return buffer ? buffer.getAll() : [];
  }

  /**
   * Stop a Claude Code process
   */
  stopClaude(process: ChildProcess, agentId?: string): void {
    if (!process.killed) {
      process.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    }

    // Clean up output buffer
    if (agentId) {
      this.outputBuffers.delete(agentId);
    }
  }
}
