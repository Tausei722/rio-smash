---
name: run-eigotaisen
description: Build and launch the EigoTaisen React Native app on the iOS simulator or a physical iPhone. Use whenever the user asks to run, launch, build, or test the EigoTaisen app on a device/simulator, or reports a build failure (linker errors, "framework not found", Pods issues) while doing so.
---

# EigoTaisenの実行

React Native 0.84.1(New Architecture / Nitro Modules)+ TypeScript。バックエンドはSupabase一本（本番と共用DB — 単語やユーザーを消すような操作はしない）。

## 基本コマンド

**シミュレータ**（重いと感じたら実機を優先）:
```bash
cd EigoTaisen
npx react-native run-ios --simulator="iPhone 16 Pro"
```

**実機**（推奨。シミュレータよりビルドが軽く感じられることが多い）:
```bash
# 接続済みデバイスのUDIDを確認
xcrun xctrace list devices

# 該当UDIDでビルド・インストール・起動
cd EigoTaisen
npx react-native run-ios --udid="<UDID>"
```

デバイスが `xcrun xctrace list devices` で `Connecting` 状態のままなら、実機側でロック解除＆「このコンピュータを信頼する」を確認してから再実行する。

必ずバックグラウンドで実行し(`run_in_background: true`、または`nohup ... &`)、ログをファイルにリダイレクトしてから待つ:
```bash
nohup npx react-native run-ios --udid="<UDID>" > /tmp/rn-ios-run.log 2>&1 &
```

## ⚠️ 既知の詰まりどころ

### 1. `react-native run-ios`のデフォルト出力では実際のリンカーエラーが見えない
`error linker command failed with exit code 1 (use -v to see invocation)` としか出ず、原因（`Undefined symbol`や`framework 'X' not found`）が分からない。`grep`で"BUILD FAILED"を待っても出てこない（RN CLIの独自フォーマッタが握りつぶす）。

**対処**: `--verbose`を付けて再実行し、生の`xcodebuild`出力を得る:
```bash
nohup npx react-native run-ios --udid="<UDID>" --verbose > /tmp/rn-ios-verbose.log 2>&1 &
```
その後 `grep -naE "BUILD SUCCEEDED|BUILD FAILED|Undefined symbol|error: linker|framework .* not found" /tmp/rn-ios-verbose.log` で本当のエラーを特定する。

### 2. `ld: framework 'React' not found`
`ios/Pods/React-Core-prebuilt/React.xcframework/<slice>/React.framework/`の中にバイナリ本体（拡張子なしの`React`ファイル）が無い状態になっていることがある（prebuiltフレームワークのダウンロード/展開が不完全）。確認方法:
```bash
file ios/Pods/React-Core-prebuilt/React.xcframework/ios-arm64/React.framework/React
```
`No such file or directory`ならPodsを入れ直す:
```bash
cd ios && rm -rf Pods && pod install
```
（このプロジェクトではbundlerを使わず素の`pod install`を使う。Xcode Cloud用の`ci_post_clone.sh`が同じ理由でbundle installを使わない設定になっている）

### 3. ビルドを`pkill`で強制終了するとDerivedDataが壊れる
シミュレータ→実機の切り替えなどでビルド中の`xcodebuild`を`pkill`すると、xcframeworkの展開が中途半端な状態でDerivedDataにキャッシュされ、次のビルドも同じ`framework not found`エラーで失敗し続ける。

**対処**: ビルドを止めるときはできるだけ完了/失敗を待つ。もし強制終了した場合は、再ビルド前に該当プロジェクトのDerivedDataを消す:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/EigoTaisen-*
```

### 4. admin-panel（Web管理画面）を同時に立ち上げる場合
```bash
cd admin-panel && BROWSER=none PORT=3123 nohup npm start > /tmp/admin-panel-start.log 2>&1 &
```
`http://localhost:3123`。ログイン画面は無い（認証なしでSupabaseにanon keyで直接読み書きする設計）。

## 確認の仕方

- **実機**: 画面を直接スクリーンショットする手段が無いので、ユーザーに目視確認してもらう
- **シミュレータ**: Playwright的な外部ツールは使えないため、`xcrun simctl io booted screenshot`は使えるが、Claude Code標準ツールでは基本ユーザーに見てもらう運用でよい
- **admin-panel**: Playwright MCPでブラウザ操作・スクリーンショットが可能（`http://localhost:3123`）

## やってはいけないこと

- 本番Supabase DBのデータ（`words`, `profiles`など）を消す・大量書き換えするコマンドを実行しない（ローカルと本番が同一DB）
- ビルド確認のためだけに新規ユーザー等を作る場合は、確認後に削除するか、ユーザーに削除してよいか確認する
