# 仕様書：カテゴリ紐づけによる親子三代英語ゲームの出し分け

実装前の設計メモ。会話（2026-08-31）で固めた方針。**実装済み**（進捗は末尾）。

---

## 概要・目的

これまで「親子三代英語ゲーム」と「2人対戦」の振り分けは、カテゴリ名が `親子3代英語シーン別辞書…` で始まるか（`OYAKO_PREFIX` の前方一致）で決めていた。これを廃止し、**`category_access` テーブルの紐づけ有無で振り分ける**。

狙い：特定ユーザーに専用の親子三代英語ゲームを届けたいとき、管理パネルで専用カテゴリを作ってそのユーザーに紐づけるだけで、そのユーザーの親子三代英語ゲームにだけ出るようにする。

## スコープ

### やること
- 振り分け基準を「カテゴリ名の接頭辞」→「`category_access` の紐づけ」に変更
- 紐づけゼロのユーザーには親子三代英語ゲームのカードを出さない
- 判定ロジックを純関数モジュールに切り出し、ユニットテストを付ける

### やらないこと（非ゴール）
- `category_access` / `words` / `app_settings` のスキーマ変更（既存のまま）
- RLS の見直し（別タスク。下記§非機能要件に注記）
- 既存の `親子3代英語シーン別辞書「…」` カテゴリ（38語・11カテゴリ）への一括紐づけ（決定B：今はそのまま。必要になったら運用で紐づける）
- 管理パネルの紐づけ UI 変更（既存の「特定のユーザーと紐付ける」をそのまま使う）

## 用語

| 語 | 意味 |
|---|---|
| 紐づけ / linked | `category_access` にそのカテゴリ×ユーザーの行がある状態 |
| 共有カテゴリ / shared | `category_access` に1件も行が無いカテゴリ。全ユーザー対象 |
| 専用カテゴリ | 紐づけのあるカテゴリ。紐づいた本人にだけ見える |

## 振り分けルール

| カテゴリの状態 | 出る場所 | 見えるユーザー |
|---|---|---|
| `category_access` に紐づけ**あり** | 親子三代英語ゲーム | 紐づいた本人だけ |
| `category_access` に紐づけ**なし** | 2人対戦のカテゴリ選択 | 全員 |

### 決定事項（会話で確定）

- **A. プレミアム判定**：自分に紐づいたカテゴリの単語は `is_premium=true` でも本人に見せる（プレミアム会員でなくても）。「専用カテゴリを渡した人には全部見せる」。
- **B. 既存の 親子3代 命名カテゴリ**：紐づけゼロなので新ルールでは全部2人対戦側に落ちる。そのままでOK。
- **C. カテゴリ無し「2人対戦」（最上段カード）**：紐づけ済み（誰かの専用）カテゴリの単語は、自分のものであっても除外する。

## 詳細設計

### 新規：`src/utils/categoryVisibility.ts`（純関数）

`import type` のみで RN 非依存。全関数の入力は `CategoryAccessMap`（`category -> user_id[]`、[database.ts:74](../src/db/database.ts#L74)）と `WordRow`。

| 関数 | 役割 |
|---|---|
| `isRestrictedCategory(cat, access)` | 紐づけが1件以上あるか（空配列は共有扱い） |
| `isCategoryLinkedToUser(cat, access, userId)` | そのカテゴリが指定ユーザーに紐づいているか（`userId===null` は false） |
| `oyakoCategoriesForUser(categories, access, userId)` | 親子三代ゲームに出すカテゴリ＝自分に紐づいたもの。空なら**カード非表示** |
| `sharedCategories(categories, access)` | 2人対戦の選択肢＝誰にも紐づいていないもの |
| `canUserSeeWord(word, {access,userId,isPremium})` | 決定A込みの単語可視判定。紐づいたカテゴリなら `is_premium` 無視で true、それ以外は `is_premium && !isPremium` で false |
| `wordsForOpenBattle(words, opts)` | カテゴリ無し2人対戦の単語。決定C（紐づけ済みカテゴリ除外）＋プレミアム判定 |
| `wordsForCategories(words, selected, opts)` | カテゴリ指定対戦の単語。親子三代ゲームとカテゴリ選択2人対戦の両方から使う。`canUserSeeWord` 経由で決定Aが効く |

### 変更：`App.tsx`

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| 単語取得（[App.tsx:157,203](../App.tsx#L157), `reloadWords`, `handleRestore`, 購入リスナ） | `fetchAllWords(isPremium)` | `fetchAllWords(true)` — 決定Aのため常に全件取り、クライアントで絞る |
| `startGame(categories?)` | `allWords.filter(...)` / `allWords` | `wordsForCategories` / `wordsForOpenBattle` |
| `OYAKO_PREFIX` + `visibleCategories` ブロック | 接頭辞フィルタ | `oyakoCategoriesForUser` / `sharedCategories` / `wordsForOpenBattle().length` |
| `wordCount` prop | `allWords.length` | `openBattleWordCount`（決定C適用済み） |
| `categories` prop（HomeScreen） | `visibleCategories`（自分の専用も含む旧定義） | `sharedCategories(...)` |
| 親子三代カードの JSX | 常に描画（0語ならグレー） | `{oyakoCategories.length > 0 && ( … )}` で囲む |

`fetchCategoryAccess()` は既に起動時と home 遷移時に呼ばれている（[App.tsx:159,206](../App.tsx#L159)）。追加の取得は不要。

### データフロー

```
起動 / home遷移
  ├ fetchAllWords(true)        → allWords（全件・premium 含む）
  ├ fetchCategoryList()        → categories（app_settings のマスター）
  ├ fetchCategoryAccess()      → categoryAccess（category -> userId[]）
  └ checkAuth()                → userId, isPremium

レンダー（ホーム）
  homeVisOpts = { access: categoryAccess, userId, isPremium }
  oyakoCategories     = oyakoCategoriesForUser(categories, access, userId)
  oyakoWordCount      = wordsForCategories(allWords, oyakoCategories, homeVisOpts).length
  visibleCategories   = sharedCategories(categories, access)   // ピッカー用
  openBattleWordCount = wordsForOpenBattle(allWords, homeVisOpts).length

対戦開始
  startGame(undefined)          → wordsForOpenBattle(allWords, opts)
  startGame(oyakoCategories)    → wordsForCategories(...)  ← 決定Aでpremiumも通る
  startGame(selectedCategories) → wordsForCategories(...)  ← 共有カテゴリ、premium判定あり
```

## 非機能要件

- **セキュリティ**：`fetchAllWords(true)` で全クライアントが `is_premium=true` の単語も取得する。現状 `words` は anon キーで全件読めるため新たな漏洩ではないが、RLS 見直し時に「premium 単語は premium 会員か紐づいたユーザーのみ返す」ポリシーが必要（別タスク。[docs/spec-icon-system.md] とは別）。
- **パフォーマンス**：`allWords` は全224語程度。クライアント側フィルタのコストは無視できる。

## 受け入れ条件

- [x] `src/utils/categoryVisibility.ts` が存在し、7関数を export
- [x] `__tests__/categoryVisibility.test.ts` が全ケース green（23件）
- [x] `npx tsc --noEmit` クリーン
- [x] `App.tsx` から `OYAKO_PREFIX` が消えている
- [x] 実機/シナリオ確認（2026-08-31、ユーザー確認OK）：
  - [x] admin（`yesterday` を紐づけ済み）でログイン → 親子三代英語ゲームのカードが出る、中身は `yesterday`
  - [x] admin で2人対戦のカテゴリ選択 → `yesterday` が選択肢に無い
  - [x] admin 以外でログイン → 親子三代英語ゲームのカードが出ない、`yesterday` も選択肢に無い
  - [x] 最上段「2人対戦」の語数が `yesterday` の1語ぶん減っている
  - [ ] 決定Aの実効確認：`is_premium=true` の単語を含む専用カテゴリを非プレミアムユーザーに紐づけて、有料単語まで出るか（未実施・§未決事項）

## 未決事項

- 決定Aの実効検証には「`is_premium=true` の単語を含む専用カテゴリ」を非プレミアムユーザーに紐づけたケースが要る。既存の `親子3代英語シーン別辞書「い」さん専用`（有料12・無料3）を誰かに紐づけて確認するのが早い。
- 親子三代ゲームのカード説明文・アイコンは据え置き（`family` アイコン、「シーン別のフレーズで親子3世代で楽しく対戦」）。専用カテゴリの内容次第で文言が合わなくなる可能性。
- `HomeScreen` 内の `pickerCategories = categories.filter(c => !oyakoCategories.includes(c))` は、`categories` が既に共有のみになったため冗長（実害なし）。次の整理で削除可。

## 参考

- 変更ファイル：[App.tsx](../App.tsx)、新規 [src/utils/categoryVisibility.ts](../src/utils/categoryVisibility.ts)、[__tests__/categoryVisibility.test.ts](../__tests__/categoryVisibility.test.ts)
- DB：`category_access`（[database.ts:74-108](../src/db/database.ts#L74-L108)）、`words.is_premium` / `words.category`（[database.ts:57-67](../src/db/database.ts#L57-L67)）
- 現在の紐づけ状況：`category_access` = `{ yesterday: [admin の user_id] }` の1件のみ
