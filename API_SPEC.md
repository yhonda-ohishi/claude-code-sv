# Multi-Agent Development System - API仕様書

フロントエンド開発者向けのAPI仕様書です。

## サーバー情報

- **HTTP API**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3002`

## HTTP API

### 1. ヘルスチェック

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": 1699411200000
}
```

---

### 2. エージェント起動

**Endpoint**: `POST /api/agents/start`

**Request**:
```json
{
  "name": "Frontend",
  "role": "フロントエンド開発担当",
  "workDir": "/path/to/project",
  "patterns": ["src/components/**", "**/*.tsx"],
  "sessionId": "optional-session-id"
}
```

**Response** (200 OK):
```json
{
  "agentId": "agent-1699411200000-abc123",
  "sessionId": "session-frontend-1699411200000",
  "status": "started"
}
```

**Error** (400 Bad Request):
```json
{
  "error": "Missing required fields"
}
```

---

### 3. エージェント停止

**Endpoint**: `POST /api/agents/stop`

**Request**:
```json
{
  "agentId": "agent-1699411200000-abc123"
}
```

**Response** (200 OK):
```json
{
  "status": "stopped"
}
```

**Error** (404 Not Found):
```json
{
  "error": "Agent not found"
}
```

---

### 4. エージェント一覧取得

**Endpoint**: `GET /api/agents`

**Response**:
```json
{
  "agents": [
    {
      "id": "agent-1699411200000-abc123",
      "sessionId": "session-frontend-1699411200000",
      "name": "Frontend",
      "role": "フロントエンド開発担当",
      "workDir": "/path/to/project",
      "patterns": ["src/components/**", "**/*.tsx"],
      "status": "running",
      "startedAt": 1699411200000
    }
  ]
}
```

---

### 5. エージェント出力取得

**Endpoint**: `GET /api/agents/:agentId/output`

**Response**:
```json
{
  "output": [
    "$ claude\n",
    "Analyzing project structure...\n",
    "Creating Button component...\n",
    "Do you want to make this edit to Button.tsx? (y/n)\n"
  ]
}
```

**Error** (404 Not Found):
```json
{
  "error": "Agent not found"
}
```

---

### 6. 変更一覧取得

**Endpoint**: `GET /api/changes`

**Response**:
```json
{
  "changes": [
    {
      "id": "change-1699411250000-xyz789",
      "sessionId": "session-frontend-1699411200000",
      "agentId": "agent-1699411200000-abc123",
      "agentName": "Frontend",
      "filePath": "src/components/Button.tsx",
      "before": "export const Button = () => {\n  return <button>Click</button>;\n}",
      "after": "export const LoginButton = () => {\n  return <button onClick={handleLogin}>Login</button>;\n}",
      "status": "pending",
      "timestamp": 1699411250000
    }
  ]
}
```

---

### 7. 特定の変更取得

**Endpoint**: `GET /api/changes/:changeId`

**Response**:
```json
{
  "id": "change-1699411250000-xyz789",
  "sessionId": "session-frontend-1699411200000",
  "agentId": "agent-1699411200000-abc123",
  "agentName": "Frontend",
  "filePath": "src/components/Button.tsx",
  "before": "...",
  "after": "...",
  "status": "pending",
  "timestamp": 1699411250000
}
```

**Error** (404 Not Found):
```json
{
  "error": "Change not found"
}
```

---

### 8. 変更承認

**Endpoint**: `POST /api/changes/:changeId/accept`

**Response** (200 OK):
```json
{
  "status": "accepted",
  "appliedAt": 1699411300000
}
```

**Error** (404 Not Found):
```json
{
  "error": "Change not found or already processed"
}
```

---

### 9. 変更拒否

**Endpoint**: `POST /api/changes/:changeId/decline`

**Response** (200 OK):
```json
{
  "status": "declined"
}
```

**Error** (404 Not Found):
```json
{
  "error": "Change not found or already processed"
}
```

---

### 10. 追加指示送信

**Endpoint**: `POST /api/changes/:changeId/instruction`

**Request**:
```json
{
  "instruction": "エラーハンドリングを追加してください"
}
```

**Response** (200 OK):
```json
{
  "status": "sent"
}
```

**Error** (400 Bad Request):
```json
{
  "error": "Missing instruction"
}
```

**Error** (404 Not Found):
```json
{
  "error": "Change not found or already processed"
}
```

---

## WebSocket API

### 接続

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => {
  // 接続成功時に購読メッセージを送信
  ws.send(JSON.stringify({ type: 'subscribe' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### イベント一覧

#### 1. エージェント起動通知

```json
{
  "type": "agent_started",
  "data": {
    "id": "agent-1699411200000-abc123",
    "sessionId": "session-frontend-1699411200000",
    "name": "Frontend",
    "role": "フロントエンド開発担当",
    "startedAt": 1699411200000,
    "status": "running"
  }
}
```

#### 2. エージェント停止通知

```json
{
  "type": "agent_stopped",
  "data": {
    "agentId": "agent-1699411200000-abc123",
    "sessionId": "session-frontend-1699411200000"
  }
}
```

#### 3. エージェント出力通知

リアルタイムでエージェントの標準出力を受信します。

```json
{
  "type": "agent_output",
  "data": {
    "agentId": "agent-1699411200000-abc123",
    "sessionId": "session-frontend-1699411200000",
    "output": "Analyzing project structure...\n",
    "timestamp": 1699411260000
  }
}
```

#### 4. 新規変更通知

エージェントが変更を提案したときに送信されます。

```json
{
  "type": "new_change",
  "data": {
    "id": "change-1699411250000-xyz789",
    "sessionId": "session-frontend-1699411200000",
    "agentId": "agent-1699411200000-abc123",
    "agentName": "Frontend",
    "filePath": "src/components/Button.tsx",
    "before": "export const Button = () => {...}",
    "after": "export const LoginButton = () => {...}",
    "status": "pending",
    "timestamp": 1699411250000
  }
}
```

#### 5. ステータス更新通知

変更のステータスが更新されたときに送信されます。

```json
{
  "type": "status_update",
  "data": {
    "changeId": "change-1699411250000-xyz789",
    "status": "accepted"
  }
}
```

---

## 型定義 (TypeScript)

```typescript
// エージェント
export interface Agent {
  id: string;
  sessionId: string;
  name: string;
  role: string;
  workDir: string;
  patterns: string[];
  status: 'running' | 'stopped';
  startedAt: number;
}

// 変更
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

// WebSocketメッセージ
export interface WebSocketMessage {
  type: 'subscribe' | 'agent_started' | 'agent_stopped' | 'new_change' | 'status_update' | 'agent_output';
  data?: any;
}

// エージェント起動リクエスト
export interface StartAgentRequest {
  name: string;
  role: string;
  workDir: string;
  patterns: string[];
  sessionId?: string;
}

// エージェント停止リクエスト
export interface StopAgentRequest {
  agentId: string;
}
```

---

## 使用例 (React + TypeScript)

### HTTP APIを使用する例

```typescript
// エージェントを起動
async function startAgent() {
  const response = await fetch('http://localhost:3001/api/agents/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Frontend',
      role: 'フロントエンド開発担当',
      workDir: '/path/to/project',
      patterns: ['src/**/*.tsx']
    })
  });

  const data = await response.json();
  console.log('Agent started:', data.agentId);
}

// 変更を承認
async function acceptChange(changeId: string) {
  const response = await fetch(`http://localhost:3001/api/changes/${changeId}/accept`, {
    method: 'POST'
  });

  const data = await response.json();
  console.log('Change accepted:', data);
}
```

### WebSocketを使用する例

```typescript
import { useEffect, useState } from 'react';

function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3002');

    socket.onopen = () => {
      console.log('WebSocket connected');
      socket.send(JSON.stringify({ type: 'subscribe' }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prev) => [...prev, message]);

      // メッセージタイプごとの処理
      switch (message.type) {
        case 'agent_started':
          console.log('Agent started:', message.data);
          break;
        case 'new_change':
          console.log('New change:', message.data);
          break;
        case 'agent_output':
          console.log('Output:', message.data.output);
          break;
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  return { ws, messages };
}
```

---

## エラーハンドリング

すべてのAPIエンドポイントは以下のHTTPステータスコードを返す可能性があります：

- **200 OK**: リクエスト成功
- **400 Bad Request**: リクエストのパラメータが不正
- **404 Not Found**: リソースが見つからない
- **500 Internal Server Error**: サーバー内部エラー

エラーレスポンスの形式：

```json
{
  "error": "エラーメッセージ"
}
```

---

## CORS設定

すべてのAPIエンドポイントでCORSが有効になっており、任意のオリジンからのリクエストを受け付けます。

---

## レート制限

現在、レート制限は実装されていません。

---

## セキュリティ

現在、認証・認可の仕組みは実装されていません。ローカル開発環境でのみ使用してください。
