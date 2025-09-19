#!/bin/bash

# Test script to check if Google OAuth configuration is working
echo "Testing Google OAuth configuration..."
echo "Timestamp: $(date)"
echo ""

# Test the OAuth URL
OAUTH_URL="https://accounts.google.com/oauth2/v2/auth?client_id=660242808945-0e6v00cqv5m7hlrcs6ll4m71g9mdo7pe.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fgoogle%2Fcallback&response_type=code&scope=openid+email+profile&state=test"

RESPONSE=$(curl -s "$OAUTH_URL" | head -n 3)

if echo "$RESPONSE" | grep -q "404"; then
    echo "❌ Configuration not ready yet - still getting 404"
else
    echo "✅ Configuration appears to be working!"
fi

echo ""
echo "Full response preview:"
echo "$RESPONSE"