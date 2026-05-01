#!/bin/sh
set -e

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1

# Add Homebrew to PATH
if [[ $(uname -m) == 'arm64' ]]; then
  export PATH="/opt/homebrew/bin:$PATH"
else
  export PATH="/usr/local/bin:$PATH"
fi

# Install Node.js
brew install node

# Install npm dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Run pod install
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
