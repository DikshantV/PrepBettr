#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Voice Interview Conversation Test${NC}"
echo -e "${BLUE}================================${NC}"

# Wait for server to be ready
echo -e "\n${YELLOW}Waiting for server to be ready...${NC}"
sleep 10

echo -e "\n${GREEN}Test 1: Start interview with preliminary question (default)${NC}"
echo "Request: Starting technical interview..."
curl -s -X POST http://localhost:3000/api/voice/conversation \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "interviewContext": {"type": "technical"}}' | \
  jq -r '.message' | head -3

echo -e "\n${GREEN}Test 2: Start interview WITHOUT preliminary question${NC}"
echo "Request: Starting behavioral interview with preliminaryCollected=true..."
curl -s -X POST http://localhost:3000/api/voice/conversation \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "interviewContext": {"type": "behavioral", "preliminaryCollected": true}}' | \
  jq -r '.message' | head -3

echo -e "\n${GREEN}Test 3: Clear conversation and start fresh${NC}"
echo "Request: Clearing conversation..."
curl -s -X POST http://localhost:3000/api/voice/conversation \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}' | jq -r '.message'

echo -e "\n${GREEN}Test 4: Start general interview with position specified${NC}"
echo "Request: Starting general interview for Software Engineer position..."
curl -s -X POST http://localhost:3000/api/voice/conversation \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "interviewContext": {"type": "general", "position": "Software Engineer"}}' | \
  jq -r '.message' | head -3

echo -e "\n${GREEN}Test 5: Process preliminary response (should transition to main interview)${NC}"
echo "Request: Sending user response to preliminary question..."
curl -s -X POST http://localhost:3000/api/voice/conversation \
  -H "Content-Type: application/json" \
  -d '{"action": "process", "userTranscript": "I am a Senior Developer with 5 years of experience in React and Node.js"}' | \
  jq '{message: .message, questionNumber: .questionNumber}' | head -10

echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}✅ Manual test complete!${NC}"
echo -e "${BLUE}================================${NC}"
