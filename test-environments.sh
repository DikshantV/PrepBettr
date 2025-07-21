#!/bin/bash

# Test script to reproduce Firestore errors in both development and production environments
echo "=== Testing Firestore operations in different environments ==="

# Check environment variables first
echo "Checking environment variables..."
node ./check-env.js

# Ask to continue if there are issues
echo ""
echo "Do you want to continue with the tests? (y/n)"
read -r response
if [[ "$response" != "y" ]]; then
  echo "Tests aborted."
  exit 0
fi

# Ensure TypeScript compilation
echo "Compiling TypeScript files..."
npx tsc -p ./tsconfig.test.json

# Development environment test
echo ""
echo "=========================================================="
echo "=== Running tests in DEVELOPMENT environment ==="
echo "=========================================================="
echo ""

# Set NODE_ENV to development
export NODE_ENV=development

echo "Testing createFeedback (write operation)..."
node ./test-firestore-error.js
echo ""

echo "Testing read operations..."
node ./test-firestore-read.js
echo ""

# Production-like environment test
echo ""
echo "=========================================================="
echo "=== Running tests in PRODUCTION-like environment ==="
echo "=========================================================="
echo ""

# Set NODE_ENV to production
export NODE_ENV=production

echo "Testing createFeedback (write operation)..."
node ./test-firestore-error.js
echo ""

echo "Testing read operations..."
node ./test-firestore-read.js
echo ""

echo "=== Tests completed ==="
