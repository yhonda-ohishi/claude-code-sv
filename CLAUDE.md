# Claude Code プロジェクト設定

## 重要: 言語設定
**常に日本語で応答してください。コンパクトモードでも日本語を使用してください。**

## プロジェクト概要
マルチエージェント開発システム - 複数のClaude Codeエージェントをブラウザから管理するシステム

## 技術スタック
- **バックエンド**: Node.js, Hono, WebSocket
- **フロントエンド**: React 18, TypeScript, Vite, TailwindCSS
- **データベース**: IndexedDB (フロントエンド側)

## ディレクトリ構造
```
├── server/          # バックエンドサーバー
│   └── src/         # TypeScriptソースコード
├── frontend/        # Reactフロントエンド
│   └── src/         # コンポーネントとフック
└── specification.md # 詳細仕様書
```

## 開発ガイドライン
1. すべての応答は日本語で行う
2. TypeScriptを使用し、型安全性を確保
3. コメントも日本語で記述
4. 既存のコーディングスタイルに従う
5. specification.mdの仕様に準拠

## 重要な制約事項

### セキュリティポリシー
- **`--allowedTools`フラグの使用禁止**: エージェント起動時に`--allowedTools`を追加してはいけない
- **自動承認の禁止**: `--permission-mode acceptEdits`など、自動承認するオプションを使用してはいけない
- **理由**: ユーザーの明示的な承認なしにファイル編集を許可することは、セキュリティリスクとなるため

### 編集権限システム - 移行計画
- **現在の実装**: Claude Code CLIを`spawn`で起動し、stream-jsonモードで制御
- **問題**: stream-jsonモードでは、インタラクティブな権限プロンプトへの応答ができない
- **解決策**: Claude Agent SDK (`@anthropic-ai/agent-sdk`)への移行
  - SDK版はCLI版と同じツールセット（Read, Write, Edit, Bash, Grep, Glob）を提供
  - `canUseTool`コールバックで権限を動的に制御可能
  - 詳細は`MIGRATION_PLAN.md`を参照

## 起動方法
- サーバー: `cd server && npm run dev` (ポート3001)
- フロントエンド: `cd frontend && npm run dev` (ポート3000)

---
**Remember: Always respond in Japanese, even in compact mode!**
