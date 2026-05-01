#!/bin/sh
set -e

# Install Node dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Run pod install (CocoaPods is pre-installed on Xcode Cloud)
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
