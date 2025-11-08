import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { WebSocketMessage, Agent, Change } from './types';

export class WebSocketHandler {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  /**
   * Setup WebSocket server
   */
  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('New WebSocket connection from', req.socket.remoteAddress);
      this.clients.add(ws);

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log(`WebSocket server listening on port ${this.wss.options.port}`);
  }

  /**
   * Handle incoming message from client
   */
  private handleClientMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (message.type === 'subscribe') {
      // Client is subscribing to updates
      console.log('Client subscribed to updates');
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Broadcast agent started event
   */
  broadcastAgentStarted(agent: Agent): void {
    this.broadcast({
      type: 'agent_started',
      data: {
        id: agent.id,
        sessionId: agent.sessionId,
        name: agent.name,
        role: agent.role,
        workDir: agent.workDir,
        patterns: agent.patterns,
        startedAt: agent.startedAt,
        status: agent.status
      }
    });
  }

  /**
   * Broadcast agent stopped event
   */
  broadcastAgentStopped(agentId: string, sessionId: string): void {
    this.broadcast({
      type: 'agent_stopped',
      data: {
        agentId,
        sessionId
      }
    });
  }

  /**
   * Broadcast agent output
   */
  broadcastAgentOutput(agentId: string, sessionId: string, output: string, timestamp: number): void {
    console.log(`[websocket.ts broadcastAgentOutput] >>> Broadcasting to ${this.clients.size} clients`);
    console.log(`[websocket.ts broadcastAgentOutput] >>> Output: "${output.substring(0, 100)}..."`);
    this.broadcast({
      type: 'agent_output',
      data: {
        agentId,
        sessionId,
        output,
        timestamp
      }
    });
  }

  /**
   * Broadcast new change
   */
  broadcastNewChange(change: Change): void {
    this.broadcast({
      type: 'new_change',
      data: change
    });
  }

  /**
   * Broadcast status update
   */
  broadcastStatusUpdate(changeId: string, status: string): void {
    this.broadcast({
      type: 'status_update',
      data: {
        changeId,
        status
      }
    });
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    // Close all client connections first
    this.clients.forEach((client) => {
      client.close();
    });
    this.clients.clear();

    // Then close the server
    this.wss.close();
  }
}
