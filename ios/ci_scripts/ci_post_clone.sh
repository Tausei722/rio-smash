#!/bin/bash
set -e

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
export LANG=en_US.UTF-8

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

# Node.js — v22 がなければインストール
if node --version 2>/dev/null | grep -q "^v22"; then
  echo "node already at v22: $(node --version)"
else
  brew install node@22
  brew link node@22 --force --overwrite
fi

echo "node: $(node --version)"
echo "npm: $(npm --version)"

# npm パッケージをインストール
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Bundler 経由で CocoaPods をインストール（Gemfile のバージョンを使用）
export GEM_HOME="$HOME/.gem"
export PATH="$GEM_HOME/bin:$PATH"
gem install bundler --no-document
bundle install

# CocoaPods
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
bundle exec pod install