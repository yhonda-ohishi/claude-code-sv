import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AgentManager } from './agent-manager';
import { StartAgentRequest, StopAgentRequest } from './types';

const execAsync = promisify(exec);

export function createRoutes(agentManager: AgentManager) {
  const app = new Hono();

  // Enable CORS for frontend
  app.use('/*', cors());

  /**
   * Start a new agent
   */
  app.post('/api/agents/start', async (c) => {
    try {
      const request: StartAgentRequest = await c.req.json();

      // Validate request
      if (!request.name || !request.role || !request.workDir || !request.patterns) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const agent = await agentManager.startAgent(request);

      return c.json({
        agentId: agent.id,
        sessionId: agent.sessionId,
        status: 'started'
      });
    } catch (error: any) {
      console.error('Failed to start agent:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);
      return c.json({ error: 'Failed to start agent', details: error.message }, 500);
    }
  });

  /**
   * Stop an agent
   */
  app.post('/api/agents/stop', async (c) => {
    try {
      const request: StopAgentRequest = await c.req.json();

      if (!request.agentId) {
        return c.json({ error: 'Missing agentId' }, 400);
      }

      const success = agentManager.stopAgent(request.agentId);

      if (!success) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      return c.json({ status: 'stopped' });
    } catch (error) {
      console.error('Failed to stop agent:', error);
      return c.json({ error: 'Failed to stop agent' }, 500);
    }
  });

  /**
   * Interrupt an agent
   */
  app.post('/api/agents/interrupt', async (c) => {
    try {
      const request: { agentId: string } = await c.req.json();

      if (!request.agentId) {
        return c.json({ error: 'Missing agentId' }, 400);
      }

      const success = agentManager.interruptAgent(request.agentId);

      if (!success) {
        return c.json({ error: 'Failed to interrupt agent' }, 400);
      }

      return c.json({ status: 'interrupted' });
    } catch (error) {
      console.error('Failed to interrupt agent:', error);
      return c.json({ error: 'Failed to interrupt agent' }, 500);
    }
  });

  /**
   * Delete an agent
   */
  app.delete('/api/agents/:agentId', async (c) => {
    try {
      const agentId = c.req.param('agentId');

      if (!agentId) {
        return c.json({ error: 'Missing agentId' }, 400);
      }

      const success = agentManager.deleteAgent(agentId);

      if (!success) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      return c.json({ status: 'deleted' });
    } catch (error) {
      console.error('Failed to delete agent:', error);
      return c.json({ error: 'Failed to delete agent' }, 500);
    }
  });

  /**
   * Get all agents
   */
  app.get('/api/agents', (c) => {
    const agents = agentManager.getAllAgents();

    // Remove process and outputBuffer from response
    const agentData = agents.map((agent) => ({
      id: agent.id,
      sessionId: agent.sessionId,
      name: agent.name,
      role: agent.role,
      workDir: agent.workDir,
      patterns: agent.patterns,
      status: agent.status,
      startedAt: agent.startedAt
    }));

    return c.json({ agents: agentData });
  });

  /**
   * Get agent output
   */
  app.get('/api/agents/:agentId/output', (c) => {
    const agentId = c.req.param('agentId');
    const output = agentManager.getAgentOutput(agentId);

    if (!output) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json({ output });
  });

  /**
   * Send message to agent
   */
  app.post('/api/agents/:agentId/message', async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const { message } = await c.req.json();

      if (!message) {
        return c.json({ error: 'Missing message' }, 400);
      }

      const success = agentManager.sendMessageToAgent(agentId, message);

      if (!success) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      return c.json({ status: 'sent' });
    } catch (error) {
      console.error('Failed to send message:', error);
      return c.json({ error: 'Failed to send message' }, 500);
    }
  });

  /**
   * Accept a change
   */
  app.post('/api/changes/:changeId/accept', (c) => {
    const changeId = c.req.param('changeId');
    const success = agentManager.acceptChange(changeId);

    if (!success) {
      return c.json({ error: 'Change not found or already processed' }, 404);
    }

    return c.json({
      status: 'accepted',
      appliedAt: Date.now()
    });
  });

  /**
   * Decline a change
   */
  app.post('/api/changes/:changeId/decline', (c) => {
    const changeId = c.req.param('changeId');
    const success = agentManager.declineChange(changeId);

    if (!success) {
      return c.json({ error: 'Change not found or already processed' }, 404);
    }

    return c.json({
      status: 'declined'
    });
  });

  /**
   * Send additional instruction
   */
  app.post('/api/changes/:changeId/instruction', async (c) => {
    try {
      const changeId = c.req.param('changeId');
      const { instruction } = await c.req.json();

      if (!instruction) {
        return c.json({ error: 'Missing instruction' }, 400);
      }

      const success = agentManager.sendInstruction(changeId, instruction);

      if (!success) {
        return c.json({ error: 'Change not found or already processed' }, 404);
      }

      return c.json({
        status: 'sent'
      });
    } catch (error) {
      console.error('Failed to send instruction:', error);
      return c.json({ error: 'Failed to send instruction' }, 500);
    }
  });

  /**
   * Get all changes
   */
  app.get('/api/changes', (c) => {
    const changes = agentManager.getAllChanges();
    return c.json({ changes });
  });

  /**
   * Get specific change
   */
  app.get('/api/changes/:changeId', (c) => {
    const changeId = c.req.param('changeId');
    const change = agentManager.getChange(changeId);

    if (!change) {
      return c.json({ error: 'Change not found' }, 404);
    }

    return c.json(change);
  });

  /**
   * Approve edit permission request
   */
  app.post('/api/agents/:agentId/edit/approve', async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const { toolUseId } = await c.req.json();

      console.log(`\n[API] POST /api/agents/${agentId}/edit/approve`);
      console.log(`[API] Tool Use ID: ${toolUseId}`);

      if (!toolUseId) {
        console.error(`[API] ❌ Missing toolUseId`);
        return c.json({ error: 'Missing toolUseId' }, 400);
      }

      const success = agentManager.approveEdit(agentId, toolUseId);

      if (!success) {
        console.error(`[API] ❌ Approval failed`);
        return c.json({ error: 'Agent not found' }, 404);
      }

      console.log(`[API] ✅ Approval successful\n`);
      return c.json({ status: 'approved' });
    } catch (error) {
      console.error('[API] ❌ Exception during approval:', error);
      return c.json({ error: 'Failed to approve edit' }, 500);
    }
  });

  /**
   * Reject edit permission request
   */
  app.post('/api/agents/:agentId/edit/reject', async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const { toolUseId } = await c.req.json();

      if (!toolUseId) {
        return c.json({ error: 'Missing toolUseId' }, 400);
      }

      const success = agentManager.rejectEdit(agentId, toolUseId);

      if (!success) {
        return c.json({ error: 'Agent not found' }, 404);
      }

      return c.json({ status: 'rejected' });
    } catch (error) {
      console.error('Failed to reject edit:', error);
      return c.json({ error: 'Failed to reject edit' }, 500);
    }
  });

  /**
   * Select directory using native OS dialog
   */
  app.get('/api/select-directory', async (c) => {
    try {
      // PowerShellスクリプトを一時ファイルに書き込み
      const psScript = `Add-Type -AssemblyName System.Windows.Forms
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "Select Work Directory"
$folderBrowser.RootFolder = [System.Environment+SpecialFolder]::MyComputer
$result = $folderBrowser.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $folderBrowser.SelectedPath
}`;

      const tempFile = path.join(os.tmpdir(), `select-dir-${Date.now()}.ps1`);
      await fs.writeFile(tempFile, psScript, 'utf8');

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
          { windowsHide: false }
        );

        const selectedPath = stdout.trim();

        console.log('Directory selection result:', { stdout, stderr, selectedPath });

        // 一時ファイル削除
        await fs.unlink(tempFile).catch(() => {});

        if (!selectedPath) {
          return c.json({ path: null, cancelled: true });
        }

        return c.json({ path: selectedPath, cancelled: false });
      } catch (execError) {
        // 一時ファイル削除
        await fs.unlink(tempFile).catch(() => {});
        throw execError;
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      return c.json({ error: 'Failed to open directory dialog' }, 500);
    }
  });

  /**
   * Health check
   */
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: Date.now() });
  });

  return app;
}
