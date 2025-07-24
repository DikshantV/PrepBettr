#!/bin/bash

# test-curl-commands.sh
# Curl-based test script for email verification and license key flow

BASE_URL="http://localhost:3000"
TEST_USER_ID="test-user-$(date +%s)"
TEST_EMAIL="test@example.com"
API_ENDPOINT="${BASE_URL}/api/test/email-license-flow"

echo "🚀 Email Verification and License Key Flow Tests"
echo "================================================"
echo "👤 Test User ID: $TEST_USER_ID"
echo "📧 Test Email: $TEST_EMAIL"
echo "🌐 API Endpoint: $API_ENDPOINT"
echo ""

# Function to make API calls
make_request() {
    local action=$1
    local additional_data=${2:-""}
    
    echo "🔄 Testing: $action"
    echo "-------------------"
    
    # Build JSON payload
    local json_payload="{\"action\":\"$action\",\"userId\":\"$TEST_USER_ID\",\"email\":\"$TEST_EMAIL\"$additional_data}"
    
    echo "Request: $json_payload"
    echo ""
    
    # Make the request
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        "$API_ENDPOINT")
    
    echo "Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    echo "═══════════════════════════════════════════════"
    echo ""
    
    # Return the response for chaining
    echo "$response"
}

# Function to extract license key from response
extract_license_key() {
    local response=$1
    echo "$response" | jq -r '.data.licenseKey // empty' 2>/dev/null
}

# Test type selection
test_type=${1:-"full"}

case $test_type in
    "full")
        echo "🎯 Running FULL FLOW TEST"
        echo ""
        make_request "full_flow_test"
        ;;
        
    "step")
        echo "🎯 Running STEP-BY-STEP TEST"
        echo ""
        
        # Step 1: Setup test user
        response1=$(make_request "setup_test_user")
        
        # Step 2: Send verification
        response2=$(make_request "send_verification")
        
        # Step 3: Verify email
        response3=$(make_request "verify_email")
        
        # Step 4: Create license key
        response4=$(make_request "create_license_key")
        
        # Extract license key
        license_key=$(extract_license_key "$response4")
        
        if [ -n "$license_key" ]; then
            echo "🔑 Extracted License Key: $license_key"
            echo ""
            
            # Step 5: Activate license
            make_request "activate_license" ",\"licenseKey\":\"$license_key\""
            
            # Step 6: Check final status
            make_request "check_status"
            
            echo "✅ Step-by-step test completed!"
        else
            echo "❌ Could not extract license key from response"
            echo "Response was: $response4"
        fi
        ;;
        
    "check")
        echo "🎯 CHECKING STATUS"
        echo ""
        make_request "check_status"
        ;;
        
    "cleanup")
        echo "🎯 CLEANING UP TEST DATA"
        echo ""
        make_request "cleanup"
        ;;
        
    "help")
        echo "📖 Usage: $0 [test_type]"
        echo ""
        echo "Available test types:"
        echo "  full     - Run complete flow test (default)"
        echo "  step     - Run step-by-step test"
        echo "  check    - Check current user status"  
        echo "  cleanup  - Clean up test data"
        echo "  help     - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 full"
        echo "  $0 step"
        echo "  $0 cleanup"
        ;;
        
    *)
        echo "❌ Unknown test type: $test_type"
        echo "Run '$0 help' for available options"
        exit 1
        ;;
esac

echo ""
echo "🏁 Test completed!"
echo ""
echo "💡 Tips for testing:"
echo "1. Check the server console for detailed logs"
echo "2. Look for email verification URLs in the console"
echo "3. License keys starting with 'MOCK-' are test keys"
echo "4. Run 'cleanup' to remove test data when done"
