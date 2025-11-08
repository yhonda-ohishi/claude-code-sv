import {
  Agent,
  StartAgentRequest,
  StartAgentResponse,
  StopAgentRequest,
  ExecuteCommandRequest,
  InstructionRequest,
  Change,
  Command,
  Message
} from '../types';

const API_BASE_URL = 'http://localhost:4001/api';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Agent management
  async startAgent(data: StartAgentRequest): Promise<StartAgentResponse> {
    return this.request<StartAgentResponse>('/agents/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async stopAgent(data: StopAgentRequest): Promise<{ status: string }> {
    return this.request('/agents/stop', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(agentId: string): Promise<{ status: string }> {
    return this.request(`/agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  async getAgents(): Promise<{ agents: Agent[] }> {
    return this.request('/agents');
  }

  async getAgentHistory(agentId: string): Promise<{ history: Message[] }> {
    return this.request(`/agents/${agentId}/history`);
  }

  async getAgentOutput(agentId: string): Promise<{ output: string[] }> {
    return this.request(`/agents/${agentId}/output`);
  }

  // Change management
  async acceptChange(changeId: string): Promise<{ status: string; appliedAt: number }> {
    return this.request(`/changes/${changeId}/accept`, {
      method: 'POST',
    });
  }

  async declineChange(changeId: string): Promise<{ status: string }> {
    return this.request(`/changes/${changeId}/decline`, {
      method: 'POST',
    });
  }

  async sendInstruction(changeId: string, data: InstructionRequest): Promise<{ status: string }> {
    return this.request(`/changes/${changeId}/instruction`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getChanges(): Promise<{ changes: Change[] }> {
    return this.request('/changes');
  }

  // Command execution
  async executeCommand(agentId: string, data: ExecuteCommandRequest): Promise<{ commandId: string; status: string }> {
    return this.request(`/agents/${agentId}/command`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCommandResult(commandId: string): Promise<Command> {
    return this.request(`/commands/${commandId}`);
  }

  // History management
  async saveHistory(agentId: string, name: string): Promise<{ savedId: string; path: string }> {
    return this.request(`/agents/${agentId}/history/save`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getHistories(): Promise<{ histories: Array<{ id: string; name: string; agentName: string; messageCount: number; lastTimestamp: number }> }> {
    return this.request('/histories');
  }

  // Message sending
  async sendMessageToAgent(agentId: string, message: string): Promise<{ status: string }> {
    return this.request(`/agents/${agentId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Edit permission management
  async approveEdit(agentId: string, toolUseId: string): Promise<{ status: string }> {
    return this.request(`/agents/${agentId}/edit/approve`, {
      method: 'POST',
      body: JSON.stringify({ toolUseId }),
    });
  }

  async rejectEdit(agentId: string, toolUseId: string): Promise<{ status: string }> {
    return this.request(`/agents/${agentId}/edit/reject`, {
      method: 'POST',
      body: JSON.stringify({ toolUseId }),
    });
  }

  // Directory selection
  async selectDirectory(): Promise<{ path: string | null; cancelled: boolean }> {
    return this.request('/select-directory');
  }
}

export const apiClient = new ApiClient();
