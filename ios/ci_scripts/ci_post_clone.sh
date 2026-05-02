#!/bin/bash
set -e

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

# Homebrew のパスを明示的に設定（Apple Silicon: /opt/homebrew）
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
else
  echo "ERROR: Homebrew not found"
  exit 1
fi

echo "brew: $(which brew)"

# Node.js をインストール
brew install node@22
brew link node@22 --force --overwrite

echo "node: $(node --version)"
echo "npm: $(npm --version)"

# npm パッケージをインストール
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# CocoaPods
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
