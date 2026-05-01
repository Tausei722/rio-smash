#!/bin/bash
set -e

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

# Setup Homebrew PATH
if [ -f "/opt/homebrew/bin/brew" ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -f "/usr/local/bin/brew" ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

# Install Node.js
brew install node

# Install npm dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Run pod install
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
