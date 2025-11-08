# Multi-Agent Development System

複数のClaude Codeエージェントによる並行開発を、ブラウザUIで一元管理・承認するシステム。

## 概要

このシステムは以下の機能を提供します：

- 複数のClaude Codeエージェントを同時に起動・管理
- コード変更提案のリアルタイム表示
- ブラウザからの承認・拒否・追加指示
- WebSocketによるリアルタイム通信
- IndexedDBによるセッション永続化

## アーキテクチャ

```
┌─────────────────────────────────┐
│  Node.jsサーバー (port 3001)     │
│  - エージェント管理              │
│  - Claude Code制御               │
│  - HTTP API                     │
│  - WebSocket (port 3002)        │
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

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- Claude Code CLI (`claude` コマンドがパスに通っていること)

### インストール

1. リポジトリをクローン

```bash
git clone <repository-url>
cd multi-agent-dev
```

2. 依存関係をインストール

```bash
# ルート、サーバー、フロントエンドすべての依存関係をインストール
npm run install:all
```

3. 環境変数を設定

```bash
# .env.example をコピーして .env を作成
cp .env.example .env

# 必要に応じて編集
nano .env
```

## 使用方法

### 開発モードで起動

```bash
# サーバーとフロントエンドを同時起動
npm run dev
```

これにより以下が起動します：
- HTTP API サーバー: http://localhost:3001
- WebSocket サーバー: ws://localhost:3002
- React フロントエンド: http://localhost:3000 (フロントエンドが実装されている場合)

### サーバーのみ起動

```bash
npm run dev:server
```

## API仕様

### エージェント管理

#### エージェント起動

```bash
POST http://localhost:3001/api/agents/start
Content-Type: application/json

{
  "name": "Frontend",
  "role": "フロントエンド開発担当",
  "workDir": "/path/to/project",
  "patterns": ["src/components/**", "**/*.tsx"],
  "sessionId": "optional-session-id"
}
```

#### エージェント停止

```bash
POST http://localhost:3001/api/agents/stop
Content-Type: application/json

{
  "agentId": "agent-123-xxx"
}
```

#### エージェント一覧取得

```bash
GET http://localhost:3001/api/agents
```

#### エージェント出力取得

```bash
GET http://localhost:3001/api/agents/:agentId/output
```

### 変更管理

#### 変更一覧取得

```bash
GET http://localhost:3001/api/changes
```

#### 変更承認

```bash
POST http://localhost:3001/api/changes/:changeId/accept
```

#### 変更拒否

```bash
POST http://localhost:3001/api/changes/:changeId/decline
```

#### 追加指示

```bash
POST http://localhost:3001/api/changes/:changeId/instruction
Content-Type: application/json

{
  "instruction": "エラーハンドリングを追加してください"
}
```

## WebSocket イベント

### クライアント → サーバー

```json
{
  "type": "subscribe"
}
```

### サーバー → クライアント

#### エージェント起動通知

```json
{
  "type": "agent_started",
  "data": {
    "id": "agent-123",
    "sessionId": "session-123-xxx",
    "name": "Frontend",
    "role": "...",
    "startedAt": 1699411200000
  }
}
```

#### エージェント出力通知

```json
{
  "type": "agent_output",
  "data": {
    "agentId": "agent-123",
    "sessionId": "session-123-xxx",
    "output": "Analyzing project structure...\n",
    "timestamp": 1699411260000
  }
}
```

#### 新規変更通知

```json
{
  "type": "new_change",
  "data": {
    "id": "change-456",
    "agentId": "agent-123",
    "agentName": "Frontend",
    "filePath": "src/components/Button.tsx",
    "before": "...",
    "after": "...",
    "status": "pending",
    "timestamp": 1699411250000
  }
}
```

## ディレクトリ構造

```
multi-agent-dev/
├── server/                 # バックエンドサーバー
│   ├── src/
│   │   ├── index.ts       # エントリーポイント
│   │   ├── agent-manager.ts      # エージェント管理
│   │   ├── claude-controller.ts  # Claude Code制御
│   │   ├── output-buffer.ts      # 出力バッファ
│   │   ├── change-parser.ts      # 変更検知・解析
│   │   ├── routes.ts             # HTTP API
│   │   ├── websocket.ts          # WebSocket処理
│   │   └── types.ts              # 型定義
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # フロントエンド (別途実装)
│   └── ...
├── package.json           # ルート (起動スクリプト)
├── .env.example
└── README.md
```

## 開発フェーズ

### Phase 1: 基本機能 ✅

- [x] プロジェクト構造作成
- [x] サーバー基本実装
- [x] WebSocket実装
- [x] エージェント管理
- [x] 出力監視

### Phase 2: 変更管理 (進行中)

- [x] 変更検知実装
- [x] 変更管理API
- [ ] フロントエンド実装
- [ ] Accept/Decline機能テスト

### Phase 3: マルチエージェント

- [ ] 複数エージェント同時動作
- [ ] フィルタリング機能

### Phase 4: 追加機能

- [ ] 追加指示機能
- [ ] 会話履歴機能
- [ ] コマンド実行機能
- [ ] エラーハンドリング

## トラブルシューティング

### Claude Codeが見つからない

```bash
# claude コマンドがインストールされているか確認
which claude

# パスを確認
echo $PATH
```

### ポートが既に使用されている

```bash
# .env ファイルでポート番号を変更
SERVER_PORT=3011
WS_PORT=3012
```

### プロセスが残っている

```bash
# プロセスを確認
ps aux | grep claude

# 強制終了
kill -9 <PID>
```

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 参考リンク

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Hono Documentation](https://hono.dev/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
