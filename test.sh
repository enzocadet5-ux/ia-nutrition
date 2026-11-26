#!/bin/sh
cd "$(dirname "$0")" && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc engine.js test.js
