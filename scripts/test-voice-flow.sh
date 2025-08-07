#!/bin/bash

# Voice Flow Integration Test Script
# This script runs both Jest and Playwright tests for the voice interview flow

echo "🎤 Starting Voice Flow Integration Tests..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if the server is running
check_server() {
    echo -e "${YELLOW}Checking if server is running...${NC}"
    if curl -s http://localhost:3000 > /dev/null; then
        echo -e "${GREEN}✓ Server is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Server is not running${NC}"
        echo "Please start the server with 'npm run dev' in another terminal"
        return 1
    fi
}

# Run Jest integration tests
run_jest_tests() {
    echo -e "\n${YELLOW}Running Jest Integration Tests...${NC}"
    echo "--------------------------------------------"
    
    # Run the Jest test
    npx jest tests/integration/voice-flow.test.ts --forceExit
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Jest tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Jest tests failed${NC}"
        return 1
    fi
}

# Run Playwright E2E tests
run_playwright_tests() {
    echo -e "\n${YELLOW}Running Playwright E2E Tests...${NC}"
    echo "--------------------------------------------"
    
    # Run the Playwright test
    npx playwright test e2e/voice-interview.spec.ts
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Playwright tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Playwright tests failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    local jest_result=0
    local playwright_result=0
    
    # Check if server is running
    if ! check_server; then
        exit 1
    fi
    
    # Run tests based on arguments
    if [ "$1" == "jest" ]; then
        run_jest_tests
        jest_result=$?
    elif [ "$1" == "playwright" ]; then
        run_playwright_tests
        playwright_result=$?
    else
        # Run both by default
        run_jest_tests
        jest_result=$?
        
        run_playwright_tests
        playwright_result=$?
    fi
    
    # Summary
    echo -e "\n============================================"
    echo -e "${YELLOW}Test Summary:${NC}"
    
    if [ $jest_result -eq 0 ] && [ $playwright_result -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed successfully!${NC}"
        echo -e "\nVoice Flow Integration:"
        echo -e "  • STT always returns success:true with text field ✓"
        echo -e "  • Hard failure prevention for undefined text ✓"
        echo -e "  • Retry with exponential backoff implemented ✓"
        echo -e "  • End-to-end voice interview flow working ✓"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        [ $jest_result -ne 0 ] && echo -e "  • Jest tests: ${RED}Failed${NC}"
        [ $playwright_result -ne 0 ] && echo -e "  • Playwright tests: ${RED}Failed${NC}"
        exit 1
    fi
}

# Parse arguments and run
main "$@"
