# 引き継ぎ: 2026-08-29 セッション全体まとめ

対象プロジェクト: `EigoTaisen`(React Native, Supabaseバックエンド)、`admin-panel`(React管理Web)、Google Play Console / Supabaseダッシュボード運用。長いセッションだったため、作業スレッド単位でまとめる。

---

## 1. iOS/Androidストア対応

### TestFlightの上げ方(再確認)
このプロジェクトは**Xcode Cloud**でiOSをビルド・TestFlight配信している(EAS build ではない)。根拠: [ios/ci_scripts/ci_post_clone.sh](../../ios/ci_scripts/ci_post_clone.sh)がXcode Cloud専用フック。`eas.json`も存在するが実際の運用ログ(git log)はXcode Cloud側。バージョン/ビルド番号を上げてmainにpushすれば自動ビルドされる。

### Google Playリジェクト対応(完了)
「誤解を与える表現」ポリシー違反でリジェクト。原因: Androidのランチャーアイコン([android/app/src/main/res/mipmap-*/ic_launcher.png](../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png))がReact Native生成時のデフォルトロボットアイコンのままで、ストア掲載アイコン([assets/icon_1024.png](../../assets/icon_1024.png))と不一致だった(iOS側は元々正しかった)。

**対応済み:**
- `assets/icon_1024.png`から各密度のmipmapを再生成([android/app/build.gradle](../../android/app/build.gradle)の`versionCode` 8→9, `versionName` 1.8.0→1.8.1)
- `./gradlew bundleRelease`でAAB再ビルド
- Play Console(Playwright操作)で「15件の変更を審査に送信」まで完了、審査提出済み

---

## 2. admin-panel(Web管理画面)の拡張

もともとユーザー管理・単語管理のみだった管理画面(認証なし、anon keyで直接Supabaseアクセス)に、以下を追加:

### ダッシュボードタブ(新規)
[admin-panel/src/pages/DashboardPage.tsx](../../../admin-panel/src/pages/DashboardPage.tsx)
- 統計カード(総ユーザー数・管理者数・プレミアムユーザー・総単語数・プレミアム単語数)
- カテゴリ別単語数の横棒グラフ(クリックで単語管理タブに絞り込み遷移)
- カテゴリのインライン名前変更・有料/無料切り替え・追加・削除
- **個人限定カテゴリの割り当てUI**(後述セクション3の一部)

### 単語管理タブの拡張
[admin-panel/src/pages/WordsPage.tsx](../../../admin-panel/src/pages/WordsPage.tsx)
- それまで`category`・`is_premium`列が全く見えず編集もできなかった不具合を修正。カテゴリ列・フィルター・編集フォームに追加

### 管理者アカウント作成
既存320アカウント中`is_admin=true`が1件も無かったため、UsersPageから新規作成: `koikekoike@hotmail.com` / パスワードはユーザー指定のもの。

---

## 3. 「親子3代英語シーン別辞書」機能 ← 今セッション最大のスレッド

### 経緯
1. 元々は「カテゴリを選んで対戦」内の13個のカテゴリ(人物タグ型4つ+シーンタグ型7つ+α)として存在していただけ
2. ホーム画面で「2人対戦」の下に**専用ゲームカード**として独立させた([App.tsx](../../App.tsx)、`OYAKO_PREFIX`で前方一致するカテゴリを束ねる)
3. その後ユーザーから重要な仕様が判明: **このモードは運営者が個人的に特定アカウントへコンテンツをプレゼントするサービス**。人物タグ型カテゴリ(`「ひび」さん専用`等)は**割り当てられた本人のアカウントにしか見せてはいけない**。シーンタグ型は引き続き有料会員なら誰でも見られる共有カテゴリ

### 実装済み
- **`category_access`テーブル**をSupabaseに新規作成(`category`, `user_id`の組み合わせで「このカテゴリはこのユーザー専用」を管理。行が無いカテゴリ=共有カテゴリという設計)
- **割り当てUI**を2箇所に実装:
  - Web: [admin-panel/src/pages/DashboardPage.tsx](../../../admin-panel/src/pages/DashboardPage.tsx) + [admin-panel/src/categoryAccess.ts](../../../admin-panel/src/categoryAccess.ts)
  - アプリ内管理画面: [src/screens/AdminScreen.tsx](../../src/screens/AdminScreen.tsx)(全画面のユーザー検索モーダル付き)+ [src/db/database.ts](../../src/db/database.ts)の`fetchCategoryAccess`/`assignCategoryToUser`/`clearCategoryAccess`/`renameCategoryAccess`
- **アプリ本体でのアクセス制御**を実装([App.tsx](../../App.tsx)の`visibleCategories`): `category_access`に登録が無いカテゴリはこれまで通り誰でも対象、登録があるカテゴリは割り当てられた本人のみ。この判定は親子3代に限らずカテゴリ全般に効く汎用ルール
- カテゴリの絵文字表示機能は検討したが**不要と判断し削除**(静的な`CATEGORY_EMOJI`マップごと削除)

### 未完了・要フォローアップ
- [ ] **RLS事故**: `category_access`作成時に誤って「Run and enable RLS」を選んでしまい、ポリシー無しのRLSが有効になって書き込み不可に。`alter table category_access disable row level security;`を実行するよう案内した。**実行完了したか未確認**
- [ ] **実際の割り当てがまだ0件**: 「ひびさん」「いさん」「やさん」「おさん」が実際にどのアカウント(username)なのか特定できていない。`profiles.email`が常にnullなので、本人にアプリ内ユーザー名を確認してもらう必要がある
- [ ] 既存4カテゴリの重複コンテンツ(表記ゆれで同じフレーズが別カテゴリに重複登録)の整理は**意図的に未着手**(ユーザーから「コンテンツデータには触れないで」と明示指示あり)
- [ ] 詳細仕様は[docs/spec-oyako-3dai.md](../spec-oyako-3dai.md)を参照(棚卸し表・未決事項を網羅)

---

## 4. 仕様書(spec-writingスキルで作成)

3ゲームモードの仕様書を`docs/`に作成:
- [spec-2players.md](../spec-2players.md) — 既存の2人対戦モード(as-built)
- [spec-oyako-3dai.md](../spec-oyako-3dai.md) — 親子3代英語(上記セクション3の詳細)
- [spec-song-mode.md](../spec-song-mode.md) — **歌モード、設計のみで未実装**。1曲分の歌詞を順番固定・シャッフル無しで出題し歌い切るゴール。データモデル(`songs`/`song_lines`テーブル案)・未決事項(ターン制を残すか、既存`words`テーブル拡張 vs 新テーブル、等)を記載

---

## 5. マイページ(プロフィール画面)

[src/screens/ProfileScreen.tsx](../../src/screens/ProfileScreen.tsx)を新規作成。ユーザー名の表示・編集・保存、会員ステータス(プレミアム/無料、管理者バッジ)、購入・復元・ログアウト・アカウント削除を1画面に集約。ハンバーガーメニュー最上部に「👤 マイページ」を追加([App.tsx](../../App.tsx))。`checkAuth`を拡張し`profiles.username`も取得するようにした。

---

## 6. 実機ビルドで踏んだ地雷(解決済み、知識として重要)

実機ビルドが`ld: framework 'React' not found`で失敗し続けた。原因は`ios/Pods/React-Core-prebuilt/React.xcframework/`内のバイナリ本体が欠損していたこと(ダウンロード/展開不良、または`pkill`でビルドを強制終了したことによるDerivedData破損)。`rm -rf ios/Pods && pod install` + DerivedDataクリアで解決。詳細と再発防止策は新規スキル[.claude/skills/run-eigotaisen/SKILL.md](../../.claude/skills/run-eigotaisen/SKILL.md)にまとめた。

---

## 7. Claude Code自体の設定まわり

- `claude-automation-recommender`スキルで自動化提案を実施。**Supabase MCPサーバーの設定を提案・着手中**(Personal Access Tokenをユーザーに依頼、まだ未取得)。設定できれば、今回のような「DDLがcurl+anon keyでは実行できない」問題が解消される
- 本スキル自体(`share-progress`、`~/.claude/skills/share-progress/SKILL.md`)を新規作成。今回のこの文書はそのテスト第一号

---

## 全体の未決事項サマリ

- [ ] `category_access`のRLS無効化、実行済みか要確認
- [ ] 「ひび/い/や/お」各さんの実アカウント特定→実際の割り当て
- [ ] Supabase MCPのPersonal Access Token取得・接続
- [ ] 歌モード(spec-song-mode.md)は仕様のみ、実装は未着手
- [ ] 親子3代カテゴリの重複コンテンツ整理は意図的に保留中(本番DB共用のため、ユーザー了承後に着手)
