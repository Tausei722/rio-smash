# 仕様書: 歌モード（新規・未実装）

## 概要・目的

英単語対戦と同じ「カタカナを見て発音→スコア判定」の仕組みを流用しつつ、出題をランダムではなく1曲分の歌詞順に固定し、最後まで歌い切ることをゴールにする新モード。ホーム画面に「2人対戦」「親子3代英語」（[spec-oyako-3dai.md](./spec-oyako-3dai.md)）に続く3つ目のカードとして追加する。

ユーザー原文（2026-08-29の会話より）:
> 英語発音対戦と同じ容量でゲームは進んでいくが、こちらが用意した順番で出てくる。歌をカタカナ英語にして順番にカードを出していき、ゲームを通して歌を歌い切れる

## スコープ

- やること: 曲を選んで、歌詞を1行ずつ順番通りに発音していき、最後の行まで到達したら完了とするゲームモード一式（データモデル・ホーム画面カード・曲選択UI・進行画面）
- やらないこと: 実際の楽曲コンテンツ入力（曲名・歌詞・カタカナ化・音声）そのものの作成。曲の追加・編集を行う管理画面UIは本仕様のスコープに含めるが、コンテンツ自体は別途用意
- 未実装: このドキュメントは実装前の設計。コード上の参照はすべて「流用元の既存パターン」であり、歌モード自体のコードはまだ存在しない

## 用語

- **曲（song）**: 歌詞全体のまとまり。1曲=複数の行（line）で構成
- **行（line）**: 歌詞の1フレーズ。既存の「単語カード」1枚に相当する最小出題単位

## 画面・UI

### ホーム画面カード

「親子3代英語」カード（[App.tsx:838-858](../App.tsx#L838-L858)）と同じ`modeCard`/`modeCardInner`構造を流用し、3枚目のカードとして追加:

```
[🎵] 歌で対戦
     好きな曲を選んで
     最後まで歌いきろう
     🎶 {曲数}曲                    ›
```

タップで直接ゲーム開始ではなく、**曲選択モーダル**を開く（複数曲を想定するため）。

### 曲選択モーダル

既存のカテゴリ選択モーダル（[App.tsx:901-938](../App.tsx#L901-L938)、`pickerOverlay`/`pickerSheet`/`pickerRow`）と同じ見た目のパターンを流用。一覧は複数選択チェックボックスではなく単一選択（曲は1つずつ通しで歌うため）:

```
┌─────────────────────────────┐
│ 曲を選択              [完了] │
├─────────────────────────────┤
│ 🎵 きらきら星       (12行) ›  │
│ 🎵 ABCの歌          (8行)  ›  │
│ 🔒 Happy Birthday   有料      │
└─────────────────────────────┘
```

行数表示、プレミアム曲は🔒ロック表示（`premiumCategories`パターンを`premiumSongs: Set<songId>`として流用）。

### ゲーム進行画面

[spec-2players.md](./spec-2players.md#画面・UI)の`WordCard`/`MicButton`/`ScoreReveal`をそのまま流用。差分は以下のみ:

- ヘッダーの「プレイヤー N のターン」→ 曲タイトル＋進捗（例: `きらきら星  3/12行`）（未決: ターン表示を残すかどうかは後述の未決事項参照）
- 「✕ やめる」は途中離脱として維持（曲を最後まで歌い切らずに終了できる）

### 完了画面

`GameOver`（[src/components/GameOver.tsx](../src/components/GameOver.tsx)）をベースに、勝敗ではなく「歌い切った」演出に差し替えるか、既存の勝敗表示に加えて完了バッジを足すかは未決（後述）。

## ユースケース

1. ホームで「歌で対戦」をタップ → 曲選択モーダルが開く
2. 曲を選ぶ → 選んだ曲の`song_lines`を`order_index`昇順で全件取得 → ゲーム画面へ
3. 1行目からカタカナカードが表示 → 発音 → スコア判定 → 「次へ」で2行目へ（**シャッフルしない**点が2人対戦との唯一の大きな差）
4. 最終行まで到達 → 完了画面（「🎉 歌い切ったね！」＋合計スコア）
5. 「✕ やめる」で途中離脱した場合は完了画面に進まずホームへ戻る（2人対戦の`handleQuitGame`と同様の挙動を想定）

### 異常系

- 選んだ曲の行が0件（データ不備）→ 2人対戦と同様に「単語がありません」相当のアラートを出し曲選択に留まる
- 音声認識で無音のまま終了 → 2人対戦と同様、スコア確定せず同じ行に留まる

## 業務ルール

- 出題順序は**固定**（`order_index`昇順）。シャッフルしない — 2人対戦・親子3代英語との唯一の必須差分
- 出題数の上限なし。曲の全行を出題する（2人対戦の「最大10問」制限は歌モードには適用しない）
- スコアリングは既存`calcPronunciationScore`をそのまま流用（[src/utils/scoring.ts:21-29](../src/utils/scoring.ts#L21-L29)）

## データモデル

新規テーブルが必要（既存`words`テーブルの流用では「固定順」「曲単位のグルーピング」「完走ゴール」を自然に表現できないため）。

```sql
create table songs (
  id           bigint generated always as identity primary key,
  title        text not null,
  artist       text,
  is_premium   boolean not null default false,
  created_at   timestamptz default now()
);

create table song_lines (
  id           bigint generated always as identity primary key,
  song_id      bigint not null references songs(id) on delete cascade,
  order_index  integer not null,          -- 曲内の順番（0始まり）
  katakana     text not null,             -- 既存 words.katakana 相当
  english      text not null,             -- 既存 words.english 相当
  japanese     text,                      -- 既存 words.japanese 相当
  detail       text,                      -- 既存 words.detail 相当
  audio_path   text,                      -- 既存 words.audio_path 相当（お手本音声）
  created_at   timestamptz default now(),
  unique (song_id, order_index)
);
```

`WordRow`（[src/db/database.ts:57-67](../src/db/database.ts#L57-L67)）とほぼ同じ列構成に`song_id`/`order_index`を足した形。`WordCard`/`ScoreReveal`など既存コンポーネントは`katakana`/`english`/`japanese`/`detail`/`audio_path`しか見ていないため、`SongLineRow`を`WordRow`と同じ形にしておけば**画面コンポーネントは無改修で流用できる**。

### 代替案（未決）

新テーブルを増やさず、既存`words`テーブルに`song_id`（nullable, FK）と`song_order`（nullable, integer）を追加する案もある。メリットは既存admin-panelの単語管理UIをほぼそのまま拡張できる点、デメリットは「ランダム出題プール」と「順番固定の曲データ」という性質の異なるデータが1テーブルに混在する点。[spec-oyako-3dai.md](./spec-oyako-3dai.md#現状のコンテンツ棚卸し)で見えている「性質の異なる分類軸を1列に混在させたことによる整理コスト」を踏まえると、新テーブルに分離する方を推奨するが、最終判断は未決。

## コンポーネント構成

- 新規: 曲選択モーダル（[App.tsx](../App.tsx)内`HomeScreen`に、既存`showCategoryPicker`と同パターンで`showSongPicker`を追加）
- 新規: `fetchSongs()`, `fetchSongLines(songId)`（[src/db/database.ts](../src/db/database.ts)に`fetchAllWords`と同パターンで追加）
- 再利用（無改修想定）: `WordCard`, `MicButton`, `ScoreBoard`, `ScoreReveal`, `calcPronunciationScore`
- 変更が要る箇所: `startGame`相当のロジック（[App.tsx:436-458](../App.tsx#L436-L458)）は「シャッフルして10件」という前提のため、歌モード用に「シャッフルしない・全件」という別関数（例: `startSong(songId)`）として分離するか、`startGame`にオプション引数（`shuffle: boolean`, `limit?: number`）を足して両対応にするか（未決）
- 管理画面: 曲・歌詞行のCRUD UI（admin-panelまたはアプリ内AdminScreen）が別途必要。[admin-panel/src/pages/WordsPage.tsx](../../admin-panel/src/pages/WordsPage.tsx)の行編集フォームと似た構成で、`order_index`のドラッグ並べ替えか上下ボタンでの並び替えが要る

## 状態管理・データフロー

`GameApp`の既存state（`gameWords`, `questionIndex`, `reveal`など）をそのまま歌モードでも使い回せる設計にする。差分は「`gameWords`への詰め方」（シャッフルの有無、件数上限の有無）と「終了判定」（`questionIndex`が曲の最終行に達したら完了、というロジック自体は既存の`isLastQuestion`判定と同じ形で流用可能）。

## 未決事項

- [ ] **2人対戦の仕組みを保つか**: 「英語発音対戦と同じ仕組み」という指示を、ターン交代（プレイヤー1↔2）も含めて維持するのか、1人（または2人で一緒に）通しで歌う形にするのかが未確定。ターンを残す場合、1行ごとに歌い手が交代する形で違和感がないか要検討
- [ ] **完了画面の見せ方**: 既存`GameOver`の「勝者/引き分け」表示をそのまま使うか、「曲を歌い切った」という達成演出に差し替えるか
- [ ] **データモデル**: 新テーブル（`songs`/`song_lines`）を作るか、既存`words`テーブルを拡張するか（上記「代替案」参照）
- [ ] **`startGame`の扱い**: 既存関数にオプションを足すか、歌モード専用の別関数にするか
- [ ] **曲データの投入方法**: 歌詞のカタカナ化（読み仮名変換）は誰が/どうやって行うか（手作業入力を想定するか、変換ツールを別途用意するか）
- [ ] **お手本音声**: 行ごとの`audio_path`を用意する運用にするか、曲全体の音声のみで行ごとの音声は無しにするか
- [ ] **途中離脱時の扱い**: 「✕ やめる」で抜けた曲の続きから再開できるようにするか、常に最初からやり直しにするか

## 受け入れ条件

（実装後に検証する項目。設計時点のチェックリスト）

- [ ] ホーム画面に「歌で対戦」カードが表示され、曲選択モーダルが開く
- [ ] 曲を選ぶと、その曲の歌詞が`order_index`順に、シャッフルされず出題される
- [ ] 曲の全行を歌い終えると完了状態になる（2人対戦のような10問打ち切りが発生しない）
- [ ] プレミアム曲は非プレミアムユーザーには🔒表示され選択できない
- [ ] 途中で「やめる」を押すとホームに戻り、完了扱いにならない

## 参考

- [spec-2players.md](./spec-2players.md) — 流用元のゲーム進行ロジック
- [spec-oyako-3dai.md](./spec-oyako-3dai.md) — 同様に既存の仕組みを流用した先行事例、コンテンツ整理の教訓
- [App.tsx](../App.tsx) — `startGame`（L436-458）, カテゴリ選択モーダル（L900-928）
- [src/components/WordCard.tsx](../src/components/WordCard.tsx), [GameOver.tsx](../src/components/GameOver.tsx)
- [src/db/database.ts](../src/db/database.ts)
