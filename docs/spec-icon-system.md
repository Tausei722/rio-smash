# 仕様書：絵文字アイコンの Lucide アイコンシステム移行

実装前の設計メモ。会話（2026-08-29）で固めた方針を、着手できる粒度に落としたもの。

## 進捗（2026-08-29）

- [x] 基盤：`lucide-react-native@1.37.0` 導入、`src/theme/icon.ts`、`src/components/Icon.tsx`（36 name をマッピング）。
- [x] **全 UI 絵文字を置き換え完了**（13ファイル）。`grep` で UI コードの絵文字は 0 件（コメント内の `→` のみ残存、無害）。`npx tsc --noEmit` クリーン。新規 eslint 指摘なし。
  - components: MicButton / GameOver / ScoreReveal / AudioTrimmer / WordDetailModal
  - screens: FlashWord / Profile / Admin / WordForm / AIConversation / Login
  - App.tsx: サイドメニュー、やめる、見本音声、モードカード4種、語数、カテゴリドロップダウン、有料バッジ、チェックボックス、プレミアムバナー/カード
  - Alert のタイトル文字列（`🔒 プレミアム限定` 等）は native 文字列なので絵文字を除去のみ
  - `🗣️`（Login ロゴ）は §未決事項どおり保留せず `speak`(Speech) に変換
- [ ] **次：実機で字形・整列・タップ領域・VoiceOver を確認**（`npm run ios -- --udid <device>`、Metro は `--reset-cache`）。
- [ ] 仕上げ：未使用になった style（`handleArrow`、Login の `emoji`、AIConversation の `micBtnText`/`sendBtnText`、GameOver の旧 `trophy` は改名済）の削除。
- 補足：`__tests__/App.test.tsx` は本移行と無関係に既存で失敗（Jest が `react-native-audio-recorder-player` の ESM を変換できていない）。AudioTrimmer の rules-of-hooks lint エラーも既存（早期 return が hooks より前）。

---

## 概要・目的

現在 UI のアイコンは絵文字（`🎤` `🔒` `⚔️` `☰` `✕` `🏆` `🤖` `⭐` `✂️` `←` `→` など）を `<Text>` で直書きしている。絵文字は端末・OS バージョンで字形・色・余白が変わり、線幅もバラバラで、これがデザインが垢抜けない主因になっている。

**単一のアイコンセット（Lucide）に統一し、サイズ・線幅・色を1箇所で管理する規則を導入する。**

対応する企画書：なし（UI 改修のため）。

---

## スコープ

### やること
- `lucide-react-native` を導入
- アイコン規則ファイル `src/theme/icon.ts` を新設
- ラッパーコンポーネント `src/components/Icon.tsx` を新設
- 操作・情報を担う絵文字を全て `<Icon>` に置き換え（下記インベントリ）
- パイロット3ファイル → 全画面の順で移行

### やらないこと（非ゴール）
- 配色・タイポグラフィ・レイアウトの刷新（アイコンのみ）
- 各画面の単色テーマ構造（`GameOver` は `#25935F`、`MicButton` は `#D75F1B` 等）を統合すること。色は今のまま各コンポーネントから `color` プロップで渡す
- 「文字としての絵文字」の撤去（演出目的の大きな `🏆` 等は対象外。§UI規則6参照）
- アイコンセットを2つ以上併用すること
- react-native-vector-icons など他ライブラリの検討（Lucide で不足したときに再検討）

---

## 対象箇所インベントリ

`grep` で確認した現状の絵文字使用（2026-08-29 時点）。矢印 `← →` は Text のまま残す案もあるが、本移行では統一のため置き換える。

| ファイル | 行 | 絵文字 | 用途 | 置き換え |
|---|---|---|---|---|
| `src/components/MicButton.tsx` | 38 | 🎤 | 発音録音ボタン | `mic`（録音中は色変更、`§UI規則1`） |
| `src/components/GameOver.tsx` | 23 / 29 | 🏆 / 🤝 | 勝敗結果（64px 演出） | `win` / `draw`（サイズ `xl`、装飾寄りだが統一） |
| `src/components/GameOver.tsx` | 52 | 🎮 | もう一度プレイ | `play` |
| `src/components/ScoreReveal.tsx` | 62 | 📖 | 使い方・文法を見る | `book` |
| `src/components/ScoreReveal.tsx` | 66 | → | 次へ | `next` |
| `src/components/AudioTrimmer.tsx` | 26 / 151 / 235 | ✂️ | 音声トリム見出し／実行 | `trim` |
| `src/components/WordDetailModal.tsx` | 42 | ✕ | モーダル閉じる | `close` |
| `src/screens/FlashWordScreen.tsx` | 125 | ← | 戻る | `back` |
| `src/screens/FlashWordScreen.tsx` | 151 / 196 | 🎤 | 録音 | `mic` |
| `src/screens/ProfileScreen.tsx` | 53 | ← | 戻る | `back` |
| `src/screens/ProfileScreen.tsx` | 90 / 99 | ⭐ / 🛡️ | プレミアム会員／管理者バッジ | `premium` / `admin` |
| `src/screens/AdminScreen.tsx` | 188 / 304 | ← | 戻る | `back` |
| `src/screens/AdminScreen.tsx` | 233 / 249 / 264 | 🔒 | 有料設定 | `lock` |
| `src/screens/AdminScreen.tsx` | 272 | 👤 | ユーザー紐付け | `profile` |
| `src/screens/AdminScreen.tsx` | 689 | 🎤 | 音声あり表示 | `mic` |
| `src/screens/WordFormScreen.tsx` | 161 | ← | 戻る | `back` |
| `src/screens/WordFormScreen.tsx` | 250 | 🎤 | 録音開始 | `mic` |
| `src/screens/WordFormScreen.tsx` | 268 | ✅ | 録音済み表示 | `checkCircle` |
| `src/screens/WordFormScreen.tsx` | 294 | ✂️ | トリム | `trim` |
| `src/screens/LoginScreen.tsx` | 120 | 🗣️ | ロゴ／ヒーロー | `speak`（※演出。要判断、`§未決事項`） |
| `src/screens/AIConversationScreen.tsx` | 224 / 252 | 🤖 | AI アバター／見出し | `ai` |
| `src/screens/AIConversationScreen.tsx` | 235 | 🔊 | 再生中 | `sound` |
| `src/screens/AIConversationScreen.tsx` | 249 | ← | 戻る | `back` |
| `src/screens/AIConversationScreen.tsx` | 313 | 🎤 | 録音 | `mic` |
| `src/screens/AIConversationScreen.tsx` | 330 | → | 送信 | `send` |
| `App.tsx` | 600 | ✕ | やめる | `close` |
| `App.tsx` | 628 | 🔊 | 再生中／見本を聞く | `sound` |
| `App.tsx` | 750 / 960 / 977 / 982 | 🔒 / ⭐ | プレミアム限定・有料・会員 | `lock` / `premium` |
| `App.tsx` | 787 / 797 | ☰ / ✕ | メニュー開閉 | `menu` / `close` |
| `App.tsx` | 801 / 805 | 👤 / ⚙️ | マイページ／管理 | `profile` / `settings` |
| `App.tsx` | 828 | ⚔️ | 対戦モード | `battle` |
| `App.tsx` | 835 / 886 | 📚 | 語数表示 | `words` |
| `App.tsx` | 879 | 👨‍👩‍👧‍👦 | 親子会話モード | `family` |
| `App.tsx` | 902 | 🤖 | AI モード | `ai` |
| `App.tsx` | 923 | ⚡ | （用途要確認） | `power`（`§未決事項`） |
| `App.tsx` | 963 | ☑ / ☐ | カテゴリ選択チェック | `checkboxOn` / `checkboxOff` |

網羅の確認は移行時に `grep -rnP "[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}]" src App.tsx` を再実行して0件になることで行う（`§受け入れ条件`）。

---

## UI規則（この移行の肝）

1. **状態は「色」で表す。アイコンの形は変えない。**
   例：`premium`（`Star`）は会員でも非会員でも `Star`。会員は `fill` プロップ＋アクセントカラー、非会員はグレーの outline。`mic` は録音中も `Mic` のまま、色を録音カラー（`#D75F1B`）に。形が変わると学習コストが上がる。
   - 例外：意味が反転する場合のみ別アイコン可（`sound` 再生中 `Volume2` / ミュート `VolumeX`、`menu`⇔`close`）。

2. **サイズは4段階のみ**：`sm=16` / `md=20` / `lg=24`（既定）/ `xl=32`。中間値を即値で書かない。演出用の特大（`GameOver` の 64px）は `xl` を `size={56}` 等でオーバーライド可だが、その1箇所に留める。

3. **線幅は全アイコン共通** `strokeWidth = 1.75`（Lucide 既定の 2 は太め。1.75 で上品に）。`icon.ts` の定数のみを参照。

4. **タップ領域はアイコンの見た目サイズと分離。** 見た目 20px でも、親の `TouchableOpacity` の padding か `hitSlop` で最低 44×44 を確保。`MicButton` のように既に十分な当たり判定がある場合はそのまま。

5. **`accessibilityLabel` を必ず付ける。** 絵文字はスクリーンリーダーが読んでいたが SVG は無言になる。`<Icon name="mic" accessibilityLabel="録音" />`。ラベルは日本語・操作名。

6. **絵文字を残してよいのは「文字としての絵文字」だけ。**
   操作要素（ボタン・トグル・ナビ）からは全撤去。判断が要るのは演出目的のもの（`LoginScreen` 120 の `🗣️` ロゴ、`GameOver` の `🏆`）。本移行では統一を優先して `🏆`/`🤝`/`🎮` も置き換える。ロゴの `🗣️` は §未決事項。

7. **1セットに固定。** Lucide に無い形は、(a) Lucide 内の近いもので代用するか、(b) `react-native-svg` で自作して 24 グリッド・`strokeWidth 1.75` に合わせる。他セットを混ぜない。

---

## 詳細設計

### 依存の追加

```bash
npm i lucide-react-native
```

- `lucide-react-native` は純 JS で、描画は `react-native-svg`（既に `^15.15.4` 導入済み・pod 済み）に委譲する。
- **ネイティブの再ビルドは不要。** `npm i` 後に Metro を再起動すれば反映される。`pod install` も不要（新規ネイティブモジュールを足さないため）。
- ライセンス：Lucide は ISC（商用可）。

### 新規ファイル1：`src/theme/icon.ts`

プロジェクトに `src/theme/` は現状無い（色は各コンポーネントの `StyleSheet` 内に直書き）。このファイルがアイコン規則の唯一の情報源になる。

```ts
export const ICON = {
  size: { sm: 16, md: 20, lg: 24, xl: 32 },
  stroke: 1.75,
} as const;

export type IconSize = keyof typeof ICON.size;
```

### 新規ファイル2：`src/components/Icon.tsx`

`src/components/` の既存コンポーネント（`MicButton.tsx` 等）と同じく関数コンポーネント＋名前付き export に倣う。

```tsx
import React from 'react';
import {
  ArrowLeft, ArrowRight, Send, Mic, MicOff, Lock, Shield, User, Settings,
  Menu, X, Swords, BookOpen, Bot, Zap, Star, Volume2, VolumeX, Trophy,
  Handshake, Scissors, Check, CircleCheck, Square, SquareCheck, Users,
  Gamepad2, BookText, MessageCircle,
  type LucideProps,
} from 'lucide-react-native';
import { ICON, type IconSize } from '../theme/icon';

const MAP = {
  back: ArrowLeft, next: ArrowRight, send: Send,
  mic: Mic, micOff: MicOff,
  lock: Lock, admin: Shield, profile: User, settings: Settings,
  menu: Menu, close: X,
  battle: Swords, words: BookOpen, book: BookText,
  ai: Bot, power: Zap, premium: Star,
  sound: Volume2, soundOff: VolumeX,
  win: Trophy, draw: Handshake, trim: Scissors, play: Gamepad2,
  check: Check, checkCircle: CircleCheck,
  checkboxOn: SquareCheck, checkboxOff: Square,
  family: Users, speak: MessageCircle,
} as const;

export type IconName = keyof typeof MAP;

type Props = {
  name: IconName;
  size?: IconSize | number;
  color?: string;
  fill?: string;
  accessibilityLabel?: string;
} & Omit<LucideProps, 'size' | 'color'>;

export function Icon({ name, size = 'lg', color = '#111', accessibilityLabel, ...rest }: Props) {
  const Cmp = MAP[name];
  const px = typeof size === 'number' ? size : ICON.size[size];
  return (
    <Cmp
      size={px}
      color={color}
      strokeWidth={ICON.stroke}
      accessibilityLabel={accessibilityLabel}
      {...rest}
    />
  );
}
```

- `name` は上表の「置き換え」列に対応。増やすときは `MAP` に1行足すだけ。
- Lucide アイコン名は要確認（`§未決事項`）：`SquareCheck`/`CircleCheck` は Lucide のバージョンで `CheckSquare`/`CheckCircle2` の場合がある。導入時に実在名へ合わせる。

### 絵文字 → Lucide マッピング（確定分）

| name | Lucide | 元絵文字 |
|---|---|---|
| back / next / send | ArrowLeft / ArrowRight / Send | ← / → / →（送信） |
| mic / micOff | Mic / MicOff | 🎤 |
| lock | Lock | 🔒 |
| admin | Shield | 🛡️ |
| profile | User | 👤 |
| settings | Settings | ⚙️ |
| menu / close | Menu / X | ☰ / ✕ |
| battle | Swords | ⚔️ |
| words / book | BookOpen / BookText | 📚 / 📖 |
| ai | Bot | 🤖 |
| power | Zap | ⚡ |
| premium | Star（会員時 fill） | ⭐ |
| sound / soundOff | Volume2 / VolumeX | 🔊 |
| win / draw | Trophy / Handshake | 🏆 / 🤝 |
| trim | Scissors | ✂️ |
| play | Gamepad2 | 🎮 |
| checkCircle | CircleCheck | ✅ |
| checkboxOn / checkboxOff | SquareCheck / Square | ☑ / ☐ |
| family | Users | 👨‍👩‍👧‍👦 |
| speak | MessageCircle | 🗣️（要判断） |

### 置き換えパターン

**Text 絵文字 → Icon（`MicButton.tsx:38`）**
```tsx
// before
<Text style={styles.icon}>🎤</Text>
// after
<Icon name="mic" size="xl" color="#fff" accessibilityLabel="録音" />
// styles.icon（fontSize: 30, zIndex: 10）は不要になる。zIndex が要るなら View でラップ
```

**状態で色替え（`MicButton` 録音中）**
```tsx
<Icon name="mic" size="xl" color={isRecording ? '#D75F1B' : '#fff'} accessibilityLabel="録音" />
```

**インラインのラベル付き（`GameOver.tsx:52` "もう一度プレイ 🎮"）**
絵文字がテキストに混ざっている箇所は、`flexDirection: 'row'` の View に分解する：
```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <Text style={styles.buttonText}>もう一度プレイ</Text>
  <Icon name="play" size="md" color="#fff" />
</View>
```

**色の渡し方**：各画面の単色テーマ（`GameOver` の `#25935F` 等、コメントで明記されている）から `color` に直接渡す。テーマ統合はしない（非ゴール）。

---

## 移行順序

1. **基盤**：`npm i lucide-react-native` → `src/theme/icon.ts` → `src/components/Icon.tsx`。`Icon` 単体を1画面で表示確認。
2. **パイロット3ファイル**：`MicButton.tsx`、`App.tsx` のヘッダー（`☰`/`✕`/`👤`/`⚙️` 787-805）、`GameOver.tsx`。実機で字形・整列・タップ領域・VoiceOver を確認。
3. **横展開**：残りの screens / components を上表の順で。1ファイルずつ差し替え、`grep` 残数を減らしていく。
4. **仕上げ**：`§受け入れ条件` のチェックを通す。不要になった `styles.icon`（`fontSize` だけの定義）を削除。

---

## 非機能要件

- **アクセシビリティ**：全 `<Icon>` に `accessibilityLabel`。装飾のみ（ラベル付きボタン内など重複する場合）は `accessibilityElementsHidden` / `importantForAccessibility="no"` で二重読み上げを防ぐ。
- **バンドルサイズ**：Lucide は import したアイコンのみバンドルされる。`Icon.tsx` で名前付き import しているので `MAP` に載せた分だけ。全部入り import はしない。
- **ビルド影響**：ネイティブ追加なし。CI／EAS の設定変更不要。
- **パフォーマンス**：SVG 描画。リスト行（`AdminScreen.tsx:689` の「音声あり」等）で多数描画される箇所は、必要なら `React.memo` 済みの行コンポーネント内で使う。現状より重くなる想定はない。

---

## 受け入れ条件

- [ ] `npm i lucide-react-native` 済み、`package.json` に記録される
- [ ] `src/theme/icon.ts` と `src/components/Icon.tsx` が存在し、`Icon` が `name` / `size` / `color` / `accessibilityLabel` を受け付ける
- [ ] `grep -rnP "[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}\x{2B00}-\x{2BFF}]" src App.tsx` が、操作・情報アイコンについて0件（意図的に残す演出絵文字があれば、その行を本仕様の§未決事項で列挙し合意済みであること）
- [ ] アイコンの `size` は `sm/md/lg/xl` またはその px 値のみ。即値の `strokeWidth` がコンポーネント側に無い（`icon.ts` 経由）
- [ ] 状態変化（録音中、プレミアム会員/非会員、再生中）でアイコンの形が変わらず、色または明示した反転ペアのみで表現されている
- [ ] タップ可能なアイコンの当たり判定が実機で 44×44 以上
- [ ] iOS 実機で VoiceOver がアイコンボタンの用途を読み上げる
- [ ] iOS / Android 両方でアイコンが表示される（`react-native-svg` 未リンクによる空白が無い）
- [ ] パイロット3ファイルのスクリーンショットで、絵文字時と比べ線幅・整列が揃っている

---

## 未決事項

- **Lucide の実在アイコン名**：`SquareCheck`/`CircleCheck` vs `CheckSquare`/`CheckCircle2`、`Swords` の有無など、導入する `lucide-react-native` のバージョンで確認して `MAP` を確定する。
- **`App.tsx:923` の `⚡` の用途**：連続正解ボーナス？　スピード？　実物を見て `Zap` / `Flame` / `Sparkles` / `Timer` から選ぶ。
- **`LoginScreen.tsx:120` の `🗣️`**：ロゴ／ヒーローの装飾。アイコン化するとかえって寂しくなる可能性。SVG ロゴを別途用意するか、絵文字のまま残すか。本移行では保留（残す）とし、別タスク化。
- **`GameOver` の `🏆`（64px 演出）**：`Trophy` を 56px で出すと線画になり華やかさが落ちる。単色テーマに合う塗り（`fill`）版にするか、勝利演出だけ絵文字を許容するか、デザイン判断が要る。
- **矢印 `←`/`→`**：戻るは端末の物理ジェスチャと重複。ヘッダー左に `ArrowLeft` を出すか、`ChevronLeft` にするか（iOS 慣習は chevron）。

---

## 参考

- 対象ファイル：上表インベントリ参照。特に `src/components/MicButton.tsx:38`、`src/components/GameOver.tsx:23,29,52`、`App.tsx:787-805`
- 既存の色の持ち方：各コンポーネントの `StyleSheet.create` 内に直書き（例 `src/components/GameOver.tsx:59-146`、`src/components/MicButton.tsx:47-86`）。`GameOver.tsx:10` に「このページは #25935F 単色テーマ」のコメント
- 既存依存：`react-native-svg ^15.15.4`（`package.json`）
- Lucide: https://lucide.dev/icons/ ／ `lucide-react-native` パッケージ
