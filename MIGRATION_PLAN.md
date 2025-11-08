# Claude Agent SDK移行計画

## 背景

### 現在の問題
- Claude Code CLIを`spawn`で起動し、`--input-format stream-json`モードで制御している
- 編集権限承認のために`stdin`に`'y'`を送信しているが、Claudeは通常のユーザーメッセージとして解釈し、権限承認として認識しない
- stream-jsonモードでは、インタラクティブな権限プロンプトへの応答がサポートされていない

### 調査結果
1. **Claude Code CLIのstream-jsonモードの制約**
   - `--input-format stream-json`は非インタラクティブモード
   - 権限プロンプトはインタラクティブ機能であり、プログラマティックに応答できない

2. **Claude Agent SDKの発見**
   - Claude Agent SDK = Claude Code CLIと同じ基盤技術をプログラムから使える形にしたもの
   - 同じツールセット（Read, Write, Edit, Bash, Grep, Globなど）を提供
   - `canUseTool`コールバックで権限を動的に制御可能

3. **VSCode拡張の実装**
   - VSCode拡張は内部的にClaudeを実行（CLIを直接使っていない）
   - 独自の権限処理システムを使用
   - つまり、VSCode拡張もSDK的なアプローチを採用している可能性が高い

## 移行方針

### アーキテクチャの変更

**現在（CLI版）:**
```
spawn claude.exe --input-format stream-json --output-format stream-json
→ stdin/stdoutでJSON通信
→ stdinで'y'を送信（動作しない）
```

**移行後（SDK版）:**
```
@anthropic-ai/agent-sdk
→ query() または stream() APIを使用
→ canUseTool コールバックで承認/拒否を実装
```

## 実装計画

### Phase 1: パッケージインストールと調査
- [ ] `@anthropic-ai/agent-sdk`をインストール
- [ ] SDKのAPIドキュメントを確認
- [ ] 簡単なサンプルコードでcanUseToolの動作を確認

### Phase 2: ClaudeControllerの書き換え
- [ ] 新しい`ClaudeControllerSDK`クラスを作成（既存のものは残す）
- [ ] `startClaude()`メソッドをSDK版に書き換え
  - `spawn`の代わりに`stream()`または`query()`を使用
  - `canUseTool`コールバックを実装
- [ ] 出力のストリーミング処理を実装
- [ ] メッセージ送信処理を実装

### Phase 3: 承認待機機構の実装
- [ ] 承認リクエストを管理する仕組みを実装
  - EventEmitterまたはPromiseベースの実装
  - toolUseIdをキーにした承認待機Map
- [ ] `canUseTool`内での承認待機処理
  ```typescript
  canUseTool: async (toolName, input) => {
    if (toolName === 'Edit') {
      // WebSocketで承認リクエストをブロードキャスト
      this.callbacks.onEditPermissionRequest({...});

      // 承認を待機（Promiseで実装）
      const approved = await this.waitForApproval(toolUseId);

      if (approved) {
        return { behavior: 'allow', updatedInput: input };
      } else {
        return { behavior: 'deny', message: 'User denied permission' };
      }
    }
    return { behavior: 'allow', updatedInput: input };
  }
  ```

### Phase 4: AgentManagerの更新
- [ ] `approveEdit()`メソッドを更新
  - 承認待機Promiseをresolveする処理に変更
- [ ] `rejectEdit()`メソッドを更新
  - 承認待機Promiseをrejectまたはfalseでresolveする処理に変更

### Phase 5: テストと検証
- [ ] 単体テスト（承認フローの動作確認）
- [ ] 統合テスト（実際のファイル編集フロー）
- [ ] エラーハンドリングの確認
  - 承認タイムアウト
  - ユーザーが拒否した場合
  - エージェントが停止した場合

### Phase 6: クリーンアップ
- [ ] 古いCLI版の実装を削除
- [ ] 不要なコードを削除
- [ ] ドキュメントを更新

## リスクと対策

### リスク1: SDK APIの理解不足
**対策:** Phase 1で十分な調査とサンプルコード実装を行う

### リスク2: 既存機能の互換性
**対策:** 段階的な移行。最初は新旧両方を保持し、動作確認後に切り替え

### リスク3: パフォーマンスの問題
**対策:** ストリーミング処理を適切に実装し、出力の遅延を最小化

## 期待される効果

1. **編集権限承認が正常に動作**
   - ユーザーがモーダルで承認/拒否できる
   - 承認後、エージェントが作業を継続できる

2. **より安定したアーキテクチャ**
   - CLIのstdin/stdoutに依存しない
   - 公式SDKのサポートを受けられる

3. **将来的な拡張性**
   - SDK APIを直接使用することで、より高度な機能を実装可能
   - フック、サブエージェント、スキルなどの機能を利用可能

## 参考資料

- [Claude Agent SDK (TypeScript)](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Agent SDK reference - TypeScript](https://docs.claude.com/en/api/agent-sdk/typescript)
