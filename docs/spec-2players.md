# 仕様書: 2人対戦モード（既存機能）

## 概要・目的

英単語対戦アプリのメインモード。カタカナ表記された英単語/フレーズを見て発音し、Levenshtein距離ベースのスコアで精度を採点、2人のプレイヤーが交互に挑戦して合計得点を競う。

このドキュメントは新規設計ではなく、既存実装の仕様化（as-built）。今後「歌モード」（[spec-song-mode.md](./spec-song-mode.md)）を追加するにあたり、共通化できる部分・できない部分を明確にするために書き起こした。

## スコープ

- 対象: ホーム画面の「2人対戦」カードから開始する既存フロー
- 対象外: 「カテゴリを選んで対戦」（同じ`startGame`を使うがカテゴリ絞り込みあり）、「親子3代英語」専用ゲーム（同じ仕組みを流用した別モード。詳細は[spec-oyako-3dai.md](./spec-oyako-3dai.md)）

## 画面・UI

### ホーム画面の起点

[App.tsx:788-807](../App.tsx#L788-L807) — 「2人対戦」カード（⚔️アイコン）。`dbReady`かつ`wordCount > 0`のときのみ活性。タップで`onStartBattle(undefined)`（＝`startGame(undefined)`、カテゴリ絞り込みなし＝全単語プール対象）。

### ゲーム画面

[App.tsx:576-641](../App.tsx#L576-L641)（`screen === 'game'`）

```
┌─────────────────────────────┐
│ プレイヤー N のターン    [✕やめる] │
├─────────────────────────────┤
│      WordCard (カタカナ表示)      │
│      [n / total]              │
├─────────────────────────────┤
│   ScoreBoard（録音中は非表示）    │
├─────────────────────────────┤
│  🔊 長押しで見本を聞く（audio_path│
│      がある単語のみ表示）          │
├─────────────────────────────┤
│      認識中テキスト（録音中）      │
│      MicButton                │
├─────────────────────────────┤
│  ScoreReveal（回答後のみ表示）    │
│  スコア・正解・次へボタン           │
└─────────────────────────────┘
```

構成コンポーネント: `WordCard`（[src/components/WordCard.tsx](../src/components/WordCard.tsx)）、`ScoreBoard`、`ScoreReveal`、`MicButton`（同ディレクトリ）。

### ゲームオーバー画面

`GameOver`コンポーネント（[src/components/GameOver.tsx](../src/components/GameOver.tsx)）。両者のスコア比較で勝者表示、引き分けなら🤝。「もう一度」相当のボタンは`onRestart={startGame}`（[App.tsx:570](../App.tsx#L570)）＝カテゴリ絞り込みなしで再スタート。

## ユースケース

1. ホームで「2人対戦」をタップ → 全単語プールからランダム10問（またはプールが10未満ならその件数）抽出
2. プレイヤー1のターンでWordCardのカタカナを見て発音 → マイクボタンで録音開始
3. 発話終了（無音2秒 or 手動停止）→ `calcPronunciationScore`でスコア確定 → ScoreReveal表示
4. 「次へ」→ スコアを該当プレイヤーに加算 → 最終問題でなければ次の問題へ・ターン交代（1→2→1→2…）
5. 最終問題の回答後 → ゲームオーバー画面へ、合計スコアで勝敗表示
6. 「やめる」ボタンでいつでも中断可能（[App.tsx:581-583](../App.tsx#L581-L583), `handleQuitGame`）

### 異常系

- 単語プールが空（フィルタ後0件）→ `Alert`で「単語がありません」、画面遷移しない（[App.tsx:444-447](../App.tsx#L444-L447)）
- 音声認識で無音のまま終了 → `Alert`で「音声を認識できませんでした」、スコア確定せず同じ問題に留まる（[App.tsx:230-234](../App.tsx#L230-L234)）
- マイク権限拒否（Android）→ `Alert`で権限エラー（[App.tsx:310-313](../App.tsx#L310-L313)）

## 業務ルール

- 1ゲームは最大10問（`Math.min(10, filtered.length)`、[App.tsx:454](../App.tsx#L454)）
- 出題順序はランダム（`shuffleArray`、[App.tsx:47-49](../App.tsx#L47-L49)、`sort(() => Math.random() - 0.5)`）
- ターンは1問ごとに交代、プレイヤー1から開始
- スコアは0〜100点（`calcPronunciationScore`、[src/utils/scoring.ts:21-29](../src/utils/scoring.ts#L21-L29)）。完全一致で100点、それ以外はLevenshtein距離ベースの減点

## データモデル

既存の`words`テーブルをそのまま利用。新規テーブルなし。

`WordRow`型（[src/db/database.ts:57-67](../src/db/database.ts#L57-L67)）:
```ts
{ id, katakana, english, japanese, detail, audio_path, is_premium, category, created_at }
```

- `allWords`は起動時・ホーム画面復帰時に`fetchAllWords(isPremium)`で取得（[App.tsx:151](../App.tsx#L151), [193-199](../App.tsx#L193-L199)）。非プレミアムユーザーは`is_premium=false`の行のみ
- 2人対戦は`category`を問わず全件が対象（[startGame](../App.tsx#L436-L458)の`categories`未指定パス）

## 状態管理

`GameApp`コンポーネント内のローカルstate（[App.tsx:76-95](../App.tsx#L76-L95)付近）: `screen`, `allWords`, `gameWords`, `questionIndex`, `currentPlayer`, `player1Score`, `player2Score`, `reveal`。React Navigation等は使わず、`screen`の値による条件分岐でシンプルな状態遷移を実装（[App.tsx:505-661](../App.tsx#L505-L661)）。

## 受け入れ条件（現状動作の確認チェックリスト）

- [ ] ホーム画面「2人対戦」カードの単語数表示が`allWords.length`と一致する
- [ ] タップ時、単語プールが0件ならアラートが出て画面遷移しない
- [ ] 出題は毎回ランダムな順序になる
- [ ] 10問（プールが10件以上の場合）で必ずゲームオーバーになる
- [ ] ターンが1問ごとにプレイヤー1↔2で交代する
- [ ] 発音が単語と完全一致した場合100点になる
- [ ] ゲームオーバー画面の勝者判定が合計スコア比較と一致する
- [ ] 「もう一度」でカテゴリ絞り込みなしの新しいゲームが始まる

## 参考

- [App.tsx](../App.tsx) — `startGame`（L436-458）, `HomeScreen`（L673以降）, ゲーム画面（L576-641）
- [src/utils/scoring.ts](../src/utils/scoring.ts)
- [src/db/database.ts](../src/db/database.ts)
