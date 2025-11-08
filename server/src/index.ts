import { serve } from '@hono/node-server';
import { AgentManager } from './agent-manager';
import { WebSocketHandler } from './websocket';
import { createRoutes } from './routes';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '4001');
const WS_PORT = parseInt(process.env.WS_PORT || '4002');

/**
 * Kill process using specified port (Windows only)
 */
async function killPortProcess(port: number): Promise<void> {
  if (process.platform !== 'win32') return;

  try {
    const { stdout } = await execAsync(`netstat -ano | findstr ":${port}"`);
    const lines = stdout.split('\n');
    const pids = new Set<string>();

    lines.forEach(line => {
      const match = line.match(/LISTENING\s+(\d+)/);
      if (match) {
        pids.add(match[1]);
      }
    });

    for (const pid of pids) {
      try {
        await execAsync(`taskkill /PID ${pid} /F /T`);
        console.log(`[Cleanup] Killed process ${pid} using port ${port}`);
      } catch {
        // Process may already be terminated
      }
    }
  } catch {
    // Port is free
  }
}

async function main() {
  console.log('Starting Multi-Agent Development Server...');

  // Clean up ports before starting
  await killPortProcess(SERVER_PORT);
  await killPortProcess(WS_PORT);

  // Initialize WebSocket handler
  const wsHandler = new WebSocketHandler(WS_PORT);

  // Initialize Agent Manager with callbacks
  const agentManager = new AgentManager({
    onAgentStarted: (agent) => {
      console.log(`Agent started: ${agent.name} (${agent.id})`);
      wsHandler.broadcastAgentStarted(agent);
    },
    onAgentStopped: (agentId, sessionId) => {
      console.log(`Agent stopped: ${agentId}`);
      wsHandler.broadcastAgentStopped(agentId, sessionId);
    },
    onAgentOutput: (agentId, sessionId, output, type) => {
      // Broadcast output to WebSocket clients
      console.log(`[index.ts onAgentOutput] >>> Callback fired for agent ${agentId}`);
      console.log(`[index.ts onAgentOutput] >>> Output: "${output.substring(0, 100)}..."`);
      console.log(`[index.ts onAgentOutput] >>> Calling broadcastAgentOutput`);
      wsHandler.broadcastAgentOutput(agentId, sessionId, output, Date.now());
    },
    onNewChange: (change) => {
      console.log(`New change detected: ${change.filePath} from ${change.agentName}`);
      wsHandler.broadcastNewChange(change);
    },
    onEditPermissionRequest: (request) => {
      console.log(`Edit permission request: ${request.filePath} from agent ${request.agentId}`);
      wsHandler.broadcastEditPermissionRequest(request);
    }
  });

  // Initialize agent manager (load persisted state)
  await agentManager.initialize();

  // Create HTTP API routes
  const app = createRoutes(agentManager);

  // Start HTTP server
  console.log(`HTTP server listening on port ${SERVER_PORT}`);
  console.log(`WebSocket server listening on port ${WS_PORT}`);
  console.log(`\nServer ready!`);
  console.log(`- API: http://localhost:${SERVER_PORT}`);
  console.log(`- WebSocket: ws://localhost:${WS_PORT}`);

  serve({
    fetch: app.fetch,
    port: SERVER_PORT
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down gracefully...');
    wsHandler.close();
    // Give time for cleanup
    setTimeout(() => process.exit(0), 500);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGUSR2', shutdown); // tsx sends this before restart
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
