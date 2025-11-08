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

## 起動方法
- サーバー: `cd server && npm run dev` (ポート3001)
- フロントエンド: `cd frontend && npm run dev` (ポート3000)

---
**Remember: Always respond in Japanese, even in compact mode!**
