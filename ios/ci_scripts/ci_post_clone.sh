#!/bin/sh
set -e

# Install Homebrew if missing
if ! command -v brew &> /dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install CocoaPods
brew install cocoapods

# Install Node & npm dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Run pod install
cd ios
pod install
