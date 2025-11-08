# マルチエージェント開発システム 仕様書

バージョン: 2.0  
最終更新: 2025-11-08

## 1. 概要

### 1.1 目的
複数のClaude Codeエージェントによる並行開発を、ブラウザUIで一元管理・承認するシステム。

### 1.2 主要機能
- 複数エージェントの同時起動・管理
- コード変更提案のリアルタイム表示
- ブラウザからの承認・拒否・追加指示

### 1.3 技術スタック
- **バックエンド**: Node.js, Hono, WebSocket
- **フロントエンド**: React 18, TypeScript, Vite, TailwindCSS
- **エージェント**: Claude Code (subprocess制御)

---

## 2. システム構成

```
┌─────────────────────────────────┐
│  Node.jsサーバー (port 3001)     │
│  - エージェント管理              │
│  - Claude Code制御               │
│  - HTTP API                     │
│  - WebSocket                    │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│  React UI (port 3000)           │
│  - エージェント起動UI            │
│  - Diff表示                     │
│  - Accept/Decline/追加指示       │
└─────────────────────────────────┘
```

---

## 3. データモデル

### 3.1 AgentSession (IndexedDB保存)

```typescript
interface AgentSession {
  id: string;              // セッションID（agent-123-1699411200000）
  agentName: string;       // "Frontend", "Backend", "Test"
  role: string;            // 役割の説明文
  workDir: string;         // 作業ディレクトリ
  patterns: string[];      // 担当ファイルパターン
  startedAt: number;       // 起動時刻
  endedAt?: number;        // 終了時刻（停止時に記録）
  status: 'running' | 'stopped';
  conversationHistory: Message[];  // 会話履歴
  outputLogs: OutputLog[];         // 出力ログ
  changes: string[];               // 変更ID一覧
}

interface OutputLog {
  timestamp: number;
  output: string;
  type: 'stdout' | 'stderr';
}
```

### 3.2 Agent (サーバー側のみ)

```typescript
interface Agent {
  id: string;              // 一意のID
  sessionId: string;       // セッションID（IndexedDBと紐付け）
  name: string;            // "Frontend", "Backend", "Test"
  role: string;            // 役割の説明文
  process: ChildProcess;   // claudeプロセス
  workDir: string;         // 作業ディレクトリ
  patterns: string[];      // 担当ファイルパターン (例: src/components/**)
  status: 'running' | 'stopped';
  startedAt: number;       // 起動時刻（Unix timestamp）
}

### 3.3 Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Command {
  id: string;
  agentId: string;
  command: string;        // 実行するコマンド
  output?: string;        // 実行結果
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: number;
}
```

### 3.4 Change

```typescript
interface Change {
  id: string;              // 一意のID
  sessionId: string;       // セッションID（AgentSessionと紐付け）
  agentId: string;         // 提案したエージェントのID
  agentName: string;       // エージェント名
  filePath: string;        // 対象ファイルのパス
  before: string;          // 変更前のコード
  after: string;           // 変更後のコード
  status: 'pending' | 'accepted' | 'declined' | 'processing';
  timestamp: number;       // 提案時刻
  instruction?: string;    // 追加指示（あれば）
}
```

---

## 4. API仕様

### 4.1 HTTP API

#### エージェント起動
```
POST /api/agents/start
Content-Type: application/json

Request:
{
  "name": "Frontend",
  "role": "フロントエンド開発担当",
  "workDir": "/path/to/project",
  "patterns": ["src/components/**", "**/*.tsx"],
  "sessionId": "session-123-1699411200000"  // オプション: 過去セッションから再開
}

Response:
{
  "agentId": "agent-123",
  "sessionId": "session-123-1699411200000",
  "status": "started"
}
```

#### セッション一覧取得（フロントエンド側IndexedDBから）
```
フロントエンドがIndexedDBから直接取得
過去セッション選択UIで使用
```

#### 会話履歴取得
```
GET /api/agents/:agentId/history

Response:
{
  "history": [
    {
      "role": "user",
      "content": "ログインボタンを作って",
      "timestamp": 1699411100000
    },
    {
      "role": "assistant",
      "content": "...",
      "timestamp": 1699411120000
    }
  ]
}
```

#### エージェント出力取得
```
GET /api/agents/:agentId/output

Response:
{
  "output": [
    "$ claude\n",
    "Analyzing project structure...\n",
    "Creating Button component...\n",
    "Do you want to make this edit to Button.tsx? (y/n)\n"
  ]
}
```

#### 会話履歴保存
```
POST /api/agents/:agentId/history/save
Content-Type: application/json

Request:
{
  "name": "frontend-session-20251108"  // 保存名
}

Response:
{
  "savedId": "history-456",
  "path": "/path/to/saved/histories/frontend-session-20251108.json"
}
```

#### 保存済み会話一覧
```
GET /api/histories

Response:
{
  "histories": [
    {
      "id": "history-456",
      "name": "frontend-session-20251108",
      "agentName": "Frontend",
      "messageCount": 12,
      "lastTimestamp": 1699411500000
    }
  ]
}
```

#### コマンド実行
```
POST /api/agents/:agentId/command
Content-Type: application/json

Request:
{
  "command": "npm test"
}

Response:
{
  "commandId": "cmd-789",
  "status": "running"
}
```

#### コマンド結果取得
```
GET /api/commands/:commandId

Response:
{
  "id": "cmd-789",
  "command": "npm test",
  "output": "PASS  src/Button.test.tsx\n...",
  "status": "completed",
  "exitCode": 0
}
```

#### エージェント停止
```
POST /api/agents/stop
Content-Type: application/json

Request:
{
  "agentId": "agent-123"
}

Response:
{
  "status": "stopped"
}
```

#### エージェント一覧取得
```
GET /api/agents

Response:
{
  "agents": [
    {
      "id": "agent-123",
      "name": "Frontend",
      "role": "フロントエンド開発担当",
      "status": "running",
      "startedAt": 1699411200000
    }
  ]
}
```

#### 変更承認
```
POST /api/changes/:changeId/accept

Response:
{
  "status": "accepted",
  "appliedAt": 1699411300000
}
```

#### 変更拒否
```
POST /api/changes/:changeId/decline

Response:
{
  "status": "declined"
}
```

#### 追加指示
```
POST /api/changes/:changeId/instruction
Content-Type: application/json

Request:
{
  "instruction": "エラーハンドリングを追加してください"
}

Response:
{
  "status": "sent"
}
```

### 4.2 WebSocket API

#### クライアント → サーバー

```typescript
// 接続時の購読
{
  "type": "subscribe"
}
```

#### サーバー → クライアント

```typescript
// エージェント起動通知
{
  "type": "agent_started",
  "data": {
    "id": "agent-123",
    "sessionId": "session-123-1699411200000",
    "name": "Frontend",
    "role": "...",
    "startedAt": 1699411200000
  }
}

// エージェント停止通知
{
  "type": "agent_stopped",
  "data": {
    "agentId": "agent-123",
    "sessionId": "session-123-1699411200000"
  }
}

// 新規変更通知
{
  "type": "new_change",
  "data": {
    "id": "change-456",
    "sessionId": "session-123-1699411200000",
    "agentId": "agent-123",
    "agentName": "Frontend",
    "filePath": "src/components/Button.tsx",
    "before": "...",
    "after": "...",
    "status": "pending",
    "timestamp": 1699411250000
  }
}

// ステータス更新通知
{
  "type": "status_update",
  "data": {
    "changeId": "change-456",
    "status": "accepted"
  }
}

// エージェント出力通知（リアルタイム）
{
  "type": "agent_output",
  "data": {
    "agentId": "agent-123",
    "sessionId": "session-123-1699411200000",
    "output": "Analyzing project structure...\n",
    "timestamp": 1699411260000
  }
}

// コマンド出力通知（ストリーミング）
{
  "type": "command_output",
  "data": {
    "commandId": "cmd-789",
    "output": "Running tests...\n",
    "status": "running"
  }
}

// コマンド完了通知
{
  "type": "command_completed",
  "data": {
    "commandId": "cmd-789",
    "exitCode": 0,
    "status": "completed"
  }
}
```

---

## 5. エージェント制御

### 5.1 起動方法

```typescript
import { spawn } from 'child_process';

const proc = spawn('claude', {
  cwd: workDir,
  env: {
    ...process.env,
    AGENT_ID: agent.id,
    AGENT_NAME: agent.name,
    AGENT_ROLE: agent.role
  },
  stdio: ['pipe', 'pipe', 'pipe']
});
```

### 5.2 出力監視

```typescript
// 全出力をリアルタイムで送信
proc.stdout.on('data', (data) => {
  const output = data.toString();
  
  // 出力バッファに保存（最新1000行）
  agent.outputBuffer.push(output);
  if (agent.outputBuffer.length > 1000) {
    agent.outputBuffer.shift();
  }
  
  // WebSocketで配信
  broadcastToClients({
    type: 'agent_output',
    data: {
      agentId: agent.id,
      output: output,
      timestamp: Date.now()
    }
  });
  
  // Claude Codeの確認プロンプトを検知
  if (output.includes('Do you want to make this edit')) {
    const change = parseChangeProposal(output);
    broadcastToClients({
      type: 'new_change',
      data: change
    });
  }
});

// stderr も同様に監視
proc.stderr.on('data', (data) => {
  const output = data.toString();
  agent.outputBuffer.push(`[stderr] ${output}`);
  
  broadcastToClients({
    type: 'agent_output',
    data: {
      agentId: agent.id,
      output: `[stderr] ${output}`,
      timestamp: Date.now()
    }
  });
});
```

### 5.3 入力制御

```typescript
// Accept
agentProcess.stdin.write('y\n');

// Decline
agentProcess.stdin.write('n\n');

// 追加指示
agentProcess.stdin.write(instruction + '\n');
```

---

## 6. 変更検知

### 6.1 方式A: stdout監視（推奨）

Claude Codeの標準出力からdiffを抽出:

```typescript
function parseChangeProposal(output: string): Change {
  // 出力例:
  // --- Button.tsx
  // +++ Button.tsx
  // @@ -1,3 +1,4 @@
  // -export const Button = ...
  // +export const LoginButton = ...
  
  const lines = output.split('\n');
  const filePath = extractFilePath(lines);
  const { before, after } = extractDiff(lines);
  
  return {
    id: generateId(),
    filePath,
    before,
    after,
    status: 'pending',
    timestamp: Date.now()
  };
}
```

### 6.2 方式B: ファイル監視（代替案）

```typescript
import chokidar from 'chokidar';

const snapshots = new Map<string, string>();

// 変更前スナップショット
function takeSnapshot(filePath: string) {
  snapshots.set(filePath, fs.readFileSync(filePath, 'utf8'));
}

// ファイル変更検知
chokidar.watch(workDir).on('change', (filePath) => {
  const before = snapshots.get(filePath) || '';
  const after = fs.readFileSync(filePath, 'utf8');
  
  broadcastChange({ filePath, before, after });
});
```

**注意:** 方式Bは書き込み後の検知のため、Decline時に元に戻す必要あり。

---

## 7. UI設計

### 7.1 画面構成

```
┌──────────────────────────────────────┐
│ 🤖 Multi-Agent Development Dashboard │
├──────────────────────────────────────┤
│ [エージェント管理] [変更一覧]        │
└──────────────────────────────────────┘
```

### 7.2 エージェント管理タブ

```
┌─────────────────────────────────────┐
│ 🚀 エージェント起動                  │
├─────────────────────────────────────┤
│ Name: [Frontend_________]           │
│ Role: [フロントエンド開発____]       │
│ Dir:  [/path/to/project____]        │
│ Patterns: [src/components/**____]   │
│                                     │
│ 📜 過去のセッションから開始（オプション）│
│ [frontend-2025-11-08-14:30 ▼]      │
│   - Frontend (停止済) 50 messages   │
│   - Frontend (停止済) 23 messages   │
│   - 新規セッション                   │
│                                     │
│ [起動]                              │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 起動中のエージェント:                │
│ ┌─────────────────────────────────┐ │
│ │ ✅ Frontend (2h 34m ago)        │ │
│ │    Session: session-123-xxx     │ │
│ │    💬 12 messages               │ │
│ │    [停止] [コマンド]            │ │
│ │    📺 [コンソール ▼]            │ │
│ │    ┌───────────────────────────┐│ │
│ │    │$ claude                   ││ │
│ │    │Analyzing project...       ││ │
│ │    │Creating Button component..││ │
│ │    │Do you want to make this...││ │
│ │    └───────────────────────────┘│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```
```

### 7.2.1 コマンド実行モーダル

```
┌─────────────────────────────────────┐
│ 💻 コマンド実行 - Frontend Agent    │
├─────────────────────────────────────┤
│ Command: [npm test______________]   │
│ [実行]                              │
│                                     │
│ 📋 出力:                            │
│ ┌─────────────────────────────────┐ │
│ │ $ npm test                      │ │
│ │ Running tests...                │ │
│ │ PASS  src/Button.test.tsx       │ │
│ │ ✓ renders correctly             │ │
│ │                                 │ │
│ │ Tests: 1 passed, 1 total        │ │
│ │ [Exit code: 0]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [閉じる]                            │
└─────────────────────────────────────┘
```

### 7.3 変更一覧タブ

```
┌─────────────────────────────────────┐
│ 📝 Change #1                        │
│ Agent: Frontend                     │
│ File: src/components/Button.tsx     │
│ Status: ⏳ Pending                  │
│ Time: 2 minutes ago                 │
│                                     │
│ ┌─────────────┬─────────────┐      │
│ │ Before      │ After       │      │
│ ├─────────────┼─────────────┤      │
│ │ export con- │ export con- │      │
│ │ st Button = │ st LoginBut-│      │
│ │ () => {     │ ton = () => │      │
│ │   return... │ {           │      │
│ │             │   return... │      │
│ └─────────────┴─────────────┘      │
│                                     │
│ [✓ Accept] [✗ Decline]             │
│                                     │
│ 💬 追加指示:                        │
│ [____________________] [送信]       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📝 Change #2                        │
│ Agent: Backend                      │
│ File: api/auth.go                   │
│ ...                                 │
└─────────────────────────────────────┘
```

### 7.4 コンポーネント構成

```
src/
├── App.tsx
├── components/
│   ├── AgentManager.tsx      # エージェント起動・管理
│   ├── AgentCard.tsx          # 起動中エージェント表示
│   ├── ConsoleViewer.tsx      # エージェント出力表示
│   ├── SessionSelector.tsx    # 過去セッション選択
│   ├── CommandModal.tsx       # コマンド実行モーダル
│   ├── ChangeList.tsx         # 変更一覧
│   ├── ChangeCard.tsx         # 個別変更カード
│   └── DiffViewer.tsx         # Before/After表示
├── hooks/
│   ├── useWebSocket.ts        # WebSocket接続
│   ├── useAgents.ts           # エージェント状態管理
│   ├── useChanges.ts          # 変更状態管理
│   ├── useCommands.ts         # コマンド実行管理
│   └── useIndexedDB.ts        # IndexedDB操作
├── api/
│   └── client.ts              # HTTP API呼び出し
├── db/
│   └── schema.ts              # IndexedDB スキーマ定義
└── types/
    └── index.ts               # 型定義
```

---

## 8. IndexedDB管理

### 8.1 データ構造

```typescript
// IndexedDB "multi-agent-dev"
// ObjectStore: "sessions"
//   keyPath: "id"
//   indexes: ["agentName", "startedAt", "status"]

// ObjectStore: "outputLogs"
//   keyPath: ["sessionId", "timestamp"]
//   indexes: ["sessionId"]

// ObjectStore: "changes"
//   keyPath: "id"
//   indexes: ["sessionId", "status"]
```

### 8.2 操作

```typescript
// セッション保存
await db.sessions.put({
  id: sessionId,
  agentName: 'Frontend',
  startedAt: Date.now(),
  status: 'running',
  ...
});

// 出力ログ追加
await db.outputLogs.add({
  sessionId: sessionId,
  timestamp: Date.now(),
  output: data,
  type: 'stdout'
});

// セッション一覧取得
const sessions = await db.sessions
  .orderBy('startedAt')
  .reverse()
  .toArray();

// 過去セッションの出力取得
const logs = await db.outputLogs
  .where('sessionId')
  .equals(sessionId)
  .toArray();
```

### 8.3 ライブラリ

- **Dexie.js** (推奨): TypeScript対応、シンプルなAPI

---

## 9. ワークフロー

### 8.1 システム起動

```
1. npm start 実行
   ↓
2. Node.jsサーバー起動 (port 3001)
   ↓
3. Vite devサーバー起動 (port 3000)
   ↓
4. ブラウザ自動オープン (http://localhost:3000)
   ↓
5. WebSocket接続確立
```

### 8.2 エージェント起動

```
1. ブラウザでエージェント設定入力
   - Name: Frontend
   - Role: フロントエンド開発
   - Dir: /path/to/project
   - Patterns: src/components/**
   ↓
2. [起動]ボタンクリック
   ↓
3. POST /api/agents/start
   ↓
4. サーバーがclaudeプロセス起動
   ↓
5. WebSocketで全クライアントに通知
   ↓
6. ブラウザに起動中エージェント表示
```

### 8.3 変更提案フロー

```
1. ユーザーがターミナルで指示（手動）
   Terminal 1: "ログインボタン作って"
   Terminal 2: "POST /login APIを作って"
   Terminal 3: "テストコードを書いて"
   ↓
2. 各エージェントがClaude API経由で作業
   ↓
3. ファイル変更を提案
   ↓
4. stdout監視で"Do you want to make this edit?"検知
   ↓
5. diffをパース
   ↓
6. WebSocketでブラウザに送信
   ↓
7. ブラウザにChangeCard表示（Pending状態）
```

### 8.4 承認・拒否フロー

#### Accept時

```
1. ブラウザで[Accept]ボタンクリック
   ↓
2. POST /api/changes/:id/accept
   ↓
3. サーバーがagentProcess.stdin.write('y\n')
   ↓
4. Claude Codeがファイルに書き込み
   ↓
5. WebSocketでステータス更新通知
   ↓
6. ブラウザ表示更新（✓ Accepted）
```

#### Decline時

```
1. ブラウザで[Decline]ボタンクリック
   ↓
2. POST /api/changes/:id/decline
   ↓
3. サーバーがagentProcess.stdin.write('n\n')
   ↓
4. Claude Codeは変更を破棄
   ↓
5. WebSocketでステータス更新通知
   ↓
6. ブラウザ表示更新（✗ Declined）
```

#### 追加指示時

```
1. ブラウザで追加指示入力 → [送信]ボタン
   例: "エラーハンドリングを追加して"
   ↓
2. POST /api/changes/:id/instruction
   ↓
3. サーバーがagentProcess.stdin.write(instruction + '\n')
   ↓
4. エージェントが再作業
   ↓
5. 新しい変更提案として再度フローが回る
```

---

## 9. ディレクトリ構造

```
multi-agent-dev/
├── server/
│   ├── src/
│   │   ├── index.ts              # エントリーポイント
│   │   ├── agent-manager.ts      # エージェント管理
│   │   ├── claude-controller.ts  # Claude Code制御
│   │   ├── output-buffer.ts      # 出力バッファ管理
│   │   ├── change-parser.ts      # diff解析
│   │   ├── routes.ts             # HTTP API
│   │   └── websocket.ts          # WebSocket処理
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── AgentManager.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   ├── ChangeList.tsx
│   │   │   ├── ChangeCard.tsx
│   │   │   └── DiffViewer.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useAgents.ts
│   │   │   └── useChanges.ts
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── package.json              # ルート（両方起動用）
├── .env.example
└── README.md
```

---

## 10. 環境変数

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
SERVER_PORT=3001
VITE_PORT=3000
```

---

## 11. 起動スクリプト

### package.json (ルート)

```json
{
  "name": "multi-agent-dev",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:frontend\"",
    "dev:server": "cd server && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "npm run build:server && npm run build:frontend",
    "build:server": "cd server && npm run build",
    "build:frontend": "cd frontend && npm run build"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### server/package.json

```json
{
  "name": "multi-agent-dev-server",
  "scripts": {
    "dev": "tsx watch --ignore 'src/**/*.test.ts' src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "ws": "^8.14.0",
    "chokidar": "^3.5.0",
    "minimatch": "^9.0.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### frontend/package.json

```json
{
  "name": "multi-agent-dev-frontend",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-diff-viewer": "^3.1.0",
    "dexie": "^4.0.0",
    "dexie-react-hooks": "^1.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

---

## 12. 開発フェーズ

### Phase 1: 基本機能（2-3日）

**目標:** 1エージェントでの基本動作確認

- [ ] プロジェクト構造作成
- [ ] サーバー基本実装
  - [ ] Hono + WebSocket
  - [ ] 1エージェント起動・停止
  - [ ] stdout監視
- [ ] フロントエンド基本実装
  - [ ] Vite + React + TailwindCSS
  - [ ] IndexedDB初期化（Dexie）
  - [ ] エージェント起動UI
  - [ ] WebSocket接続
  - [ ] 出力/変更をIndexedDBに保存
- [ ] 動作確認
  - [ ] `npm run dev`で起動
  - [ ] ブラウザからエージェント起動
  - [ ] ターミナル出力確認
  - [ ] ページリロード後もデータ残存確認

### Phase 2: 変更管理（3-4日）

**目標:** 変更提案の検知・表示・承認

- [ ] 出力監視実装
  - [ ] stdout/stderrの完全キャプチャ
  - [ ] 出力バッファ管理
  - [ ] WebSocketでリアルタイム配信
- [ ] diff検知実装
  - [ ] stdout監視でプロンプト検知
  - [ ] diffパーサー実装
- [ ] 変更管理API
  - [ ] POST /api/changes/:id/accept
  - [ ] POST /api/changes/:id/decline
  - [ ] GET /api/agents/:id/output
- [ ] フロントエンド
  - [ ] ConsoleViewer（折りたたみ可能）
  - [ ] ChangeList/ChangeCard
  - [ ] DiffViewer（react-diff-viewer）
  - [ ] Accept/Declineボタン
- [ ] stdin制御
  - [ ] 'y'/'n'の送信
- [ ] 動作確認
  - [ ] エージェントに指示
  - [ ] コンソール出力がリアルタイム表示
  - [ ] ブラウザで変更表示
  - [ ] Accept/Decline動作

### Phase 3: マルチエージェント（2-3日）

**目標:** 複数エージェントの同時動作

- [ ] 複数エージェント起動
- [ ] エージェント識別（環境変数）
- [ ] 変更一覧の複数表示
- [ ] フィルタリング機能
- [ ] 動作確認
  - [ ] 3エージェント同時起動
  - [ ] 各エージェントからの変更表示
  - [ ] 個別に承認・拒否

### Phase 4: 追加機能（3-4日）

**目標:** 実用性の向上

- [ ] 追加指示機能
  - [ ] POST /api/changes/:id/instruction
  - [ ] stdinへの送信
  - [ ] UI実装
- [ ] 会話履歴機能
  - [ ] 履歴の保存・読み込み
  - [ ] 過去の会話から再開
  - [ ] UI実装（HistorySelector）
- [ ] コマンド実行機能
  - [ ] POST /api/agents/:id/command
  - [ ] stdout/stderrのストリーミング
  - [ ] UI実装（CommandModal）
- [ ] ステータス管理
  - [ ] 履歴表示
  - [ ] フィルター（Pending/Accepted/Declined）
- [ ] エラーハンドリング
  - [ ] プロセス異常終了
  - [ ] 再起動機能
- [ ] 担当範囲チェック（オプション）

### Phase 5: 改善・最適化（随時）

- [ ] パフォーマンス改善
- [ ] UI/UX改善
- [ ] ログ機能
- [ ] ドキュメント整備

---

## 13. 開発時の注意事項

### 14.1 プロセス管理

**課題:** サーバーコード変更時の再起動でClaudeプロセスが終了

**対応:**

1. **tsx watch使用**
   ```json
   "dev": "tsx watch --ignore 'src/**/*.test.ts' src/index.ts"
   ```
   - テストファイル等の変更は無視
   - 本質的な変更のみ再起動

2. **開発時のベストプラクティス**
   - サーバーコードを頻繁に変更しない
   - 大きな変更はClaudeプロセス停止後に実施
   - または手動でClaudeを起動し、サーバーは監視のみに

3. **プロセス状態の保存（将来的）**
   - エージェント情報をファイル/DBに保存
   - 再起動時に復元

---

## 14. 技術的課題と対応

### 15.1 diff検知の精度

**課題:** Claude Codeの出力フォーマットが不明確

**対応:**
1. Phase 1で実際の出力を確認
2. パーサーを調整
3. 必要ならファイル監視方式に切り替え

### 14.2 stdin制御の信頼性

**課題:** 'y'/'n'が正しく送信されるか不明

**対応:**
1. テスト実装で確認
2. プロンプト検知後の待機時間調整
3. 必要ならClaude Code APIを調査

### 14.3 VSCode拡張の必要性

**課題:** stdout監視では限界がある可能性

**対応:**
1. Phase 2で判断
2. 必要なら仕様書v3.0で拡張版を検討
3. 現時点では保留

---

## 14. 成功基準

### Minimum Viable Product (MVP)

- [ ] 3つのエージェントを同時起動できる
- [ ] 各エージェントからの変更提案がブラウザに表示される
- [ ] ブラウザからAccept/Declineできる
- [ ] Accept時にファイルが正しく更新される
- [ ] Decline時に変更が破棄される

### Full Product

- [ ] 追加指示機能が動作する
- [ ] 変更履歴が表示される
- [ ] エラーが適切に処理される
- [ ] 担当範囲外への変更が警告される
- [ ] UIが使いやすい

---

## 15. 参考リンク

- Claude Code: https://docs.anthropic.com/en/docs/claude-code/overview
- Clineリポジトリ: https://github.com/project-copilot/claude-dev
- React Diff Viewer: https://github.com/praneshr/react-diff-viewer

---

## 16. 変更履歴

- 2025-11-08: v2.0 - Node.jsアプリベースに変更（VSCode拡張は保留）
- 2025-11-08: v1.0 - 初版作成

---

以上