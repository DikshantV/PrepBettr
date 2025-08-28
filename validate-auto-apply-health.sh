#!/bin/bash

# Auto-Apply System Health Validation Script
# Run this script to validate the production health of your auto-apply system

FUNCTION_APP_URL=${1:-"https://prepbettr-auto-apply.azurewebsites.net"}
HEALTH_ENDPOINT="$FUNCTION_APP_URL/api/health"

echo "🏥 Validating Auto-Apply System Health"
echo "======================================"
echo "Function App: $FUNCTION_APP_URL"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health_response "$HEALTH_ENDPOINT")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -c 4)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health endpoint responding (HTTP $HTTP_CODE)"
    
    # Parse health response
    if command -v jq &> /dev/null; then
        HEALTH_DATA=$(cat /tmp/health_response)
        echo "   📊 Health Status:"
        echo "      - Status: $(echo "$HEALTH_DATA" | jq -r '.status // "unknown"')"
        echo "      - Active Browsers: $(echo "$HEALTH_DATA" | jq -r '.activeBrowsers // "unknown"')"
        echo "      - Max Browsers: $(echo "$HEALTH_DATA" | jq -r '.maxConcurrentBrowsers // "unknown"')"
        echo "      - Queued Operations: $(echo "$HEALTH_DATA" | jq -r '.queuedOperations // "unknown"')"
    else
        echo "   📄 Health Response:"
        cat /tmp/health_response | head -5
    fi
else
    echo "   ❌ Health endpoint failed (HTTP $HTTP_CODE)"
    cat /tmp/health_response
fi

echo ""

# Test function app availability
echo "2. Testing function app availability..."
PING_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$FUNCTION_APP_URL")
if [ "$PING_RESPONSE" = "200" ] || [ "$PING_RESPONSE" = "404" ]; then
    echo "   ✅ Function app is accessible"
else
    echo "   ❌ Function app not accessible (HTTP $PING_RESPONSE)"
fi

echo ""

# Check Azure Function logs (requires Azure CLI)
echo "3. Checking recent function logs..."
if command -v az &> /dev/null && az account show &> /dev/null; then
    FUNCTION_APP_NAME=$(echo "$FUNCTION_APP_URL" | sed 's|https://||' | sed 's|\.azurewebsites\.net.*||')
    
    echo "   📜 Recent application events:"
    az monitor app-insights query \
        --app "prepbettr-auto-apply-insights" \
        --analytics-query "customEvents | where timestamp > ago(1h) | where name in ('applicationSuccess', 'applicationError') | project timestamp, name, customDimensions | take 5" \
        --output table 2>/dev/null || echo "   ⚠️  Unable to fetch recent logs"
else
    echo "   ⚠️  Azure CLI not available for log checking"
fi

echo ""
echo "🎯 Health validation complete"
echo ""
echo "Next steps if issues found:"
echo "1. Check Application Insights for detailed logs"
echo "2. Review Function App configuration in Azure Portal"
echo "3. Validate environment variables and secrets"
echo "4. Check storage account connectivity"
