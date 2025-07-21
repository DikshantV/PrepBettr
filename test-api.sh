#!/bin/bash

echo "=== Testing Firestore operations through Next.js API ==="

# Development environment test
echo ""
echo "=========================================================="
echo "=== Running tests in DEVELOPMENT environment ==="
echo "=========================================================="
echo ""

# Start Next.js dev server in background
echo "Starting Next.js development server..."
NODE_ENV=development npx next dev --turbopack > dev-server.log 2>&1 &
DEV_SERVER_PID=$!

# Wait for server to start
echo "Waiting for development server to start..."
sleep 10

# Test read operations
echo "Testing read operations..."
curl -s "http://localhost:3000/api/test-firestore?mode=read" | tee dev-read-results.json

# Test write operations
echo ""
echo "Testing write operations..."
curl -s "http://localhost:3000/api/test-firestore?mode=write" | tee dev-write-results.json

# Kill dev server
echo ""
echo "Stopping development server..."
kill $DEV_SERVER_PID

# Wait for server to stop
sleep 5

# Production-like environment test
echo ""
echo "=========================================================="
echo "=== Running tests in PRODUCTION-like environment ==="
echo "=========================================================="
echo ""

# Build Next.js app
echo "Building Next.js app for production..."
NODE_ENV=production npx next build > build.log 2>&1

# Start Next.js production server in background
echo "Starting Next.js production server..."
NODE_ENV=production npx next start > prod-server.log 2>&1 &
PROD_SERVER_PID=$!

# Wait for server to start
echo "Waiting for production server to start..."
sleep 10

# Test read operations
echo "Testing read operations..."
curl -s "http://localhost:3000/api/test-firestore?mode=read" | tee prod-read-results.json

# Test write operations
echo ""
echo "Testing write operations..."
curl -s "http://localhost:3000/api/test-firestore?mode=write" | tee prod-write-results.json

# Kill production server
echo ""
echo "Stopping production server..."
kill $PROD_SERVER_PID

echo ""
echo "=== Tests completed ==="
echo "Results saved to dev-read-results.json, dev-write-results.json, prod-read-results.json, and prod-write-results.json"
