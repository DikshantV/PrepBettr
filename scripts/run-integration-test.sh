#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Voice Interview Integration Test Suite${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if dev server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✅ Development server is already running on port 3000${NC}"
    SERVER_PID=""
else
    echo -e "${YELLOW}Starting Next.js development server...${NC}"
    # Start the dev server in the background
    npm run dev > /tmp/nextjs-dev.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to be ready
    echo -e "${YELLOW}Waiting for server to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Server failed to start after 30 seconds${NC}"
            echo -e "${RED}Check /tmp/nextjs-dev.log for details${NC}"
            if [ ! -z "$SERVER_PID" ]; then
                kill $SERVER_PID 2>/dev/null
            fi
            exit 1
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

# Run the integration tests
echo -e "\n${BLUE}Running voice interview integration tests...${NC}"
echo -e "${BLUE}======================================${NC}"

node scripts/test-voice-interview-flow.js
TEST_RESULT=$?

# Clean up if we started the server
if [ ! -z "$SERVER_PID" ]; then
    echo -e "\n${YELLOW}Stopping development server...${NC}"
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    echo -e "${GREEN}✅ Server stopped${NC}"
fi

# Show test results
echo -e "\n${BLUE}======================================${NC}"
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All integration tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
fi
echo -e "${BLUE}======================================${NC}"

exit $TEST_RESULT
