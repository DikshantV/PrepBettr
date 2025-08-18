#!/bin/bash

# DNS Propagation Monitor for Azure Domain Validation
# Run this script to check if your DNS changes have propagated

echo "🔍 DNS Propagation Monitor for prepbettr.com"
echo "=============================================="
echo "Started: $(date)"
echo ""

check_dns() {
    echo "📡 Checking DNS propagation..."
    echo ""
    
    # Check CAA record (should be empty)
    echo "1. CAA Record (should be empty):"
    CAA_RESULT=$(dig prepbettr.com CAA +short)
    if [ -z "$CAA_RESULT" ]; then
        echo "   ✅ GOOD: No CAA record found (SSL not blocked)"
        CAA_FIXED=true
    else
        echo "   ❌ ISSUE: CAA record still exists: $CAA_RESULT"
        echo "   🔧 ACTION: Delete the CAA record from your DNS provider"
        CAA_FIXED=false
    fi
    echo ""
    
    # Check A record (should be 168.63.140.18)
    echo "2. A Record (should be 168.63.140.18):"
    A_RESULT=$(dig prepbettr.com A +short)
    if [ "$A_RESULT" = "168.63.140.18" ]; then
        echo "   ✅ GOOD: A record points to correct Azure IP: $A_RESULT"
        A_FIXED=true
    else
        echo "   ⚠️  ISSUE: A record shows: $A_RESULT"
        echo "   🔧 ACTION: Update A record to 168.63.140.18"
        A_FIXED=false
    fi
    echo ""
    
    # Check _dnsauth record (should return validation token)
    echo "3. DNS Auth Record (should return validation token):"
    AUTH_RESULT=$(dig _dnsauth.prepbettr.com TXT +short)
    if [[ "$AUTH_RESULT" == *"_sublkgv7ispv97e1i2cqtzq3i3jz7ge"* ]]; then
        echo "   ✅ GOOD: DNS auth record found: $AUTH_RESULT"
        AUTH_FIXED=true
    else
        echo "   ❌ ISSUE: DNS auth record not found or incorrect"
        echo "   🔧 ACTION: Add TXT record _dnsauth.prepbettr.com → _sublkgv7ispv97e1i2cqtzq3i3jz7ge"
        AUTH_FIXED=false
    fi
    echo ""
    
    # Check existing TXT records (should be preserved)
    echo "4. Existing TXT Records (should be preserved):"
    TXT_RESULTS=$(dig prepbettr.com TXT +short)
    echo "   Current TXT records:"
    echo "$TXT_RESULTS" | sed 's/^/   /'
    if [[ "$TXT_RESULTS" == *"_sublkgv7ispv97e1i2cqtzq3i3jz7ge"* ]] && [[ "$TXT_RESULTS" == *"v=spf1"* ]]; then
        echo "   ✅ GOOD: Required TXT records are preserved"
        TXT_PRESERVED=true
    else
        echo "   ⚠️  CHECK: Verify both validation token and SPF record exist"
        TXT_PRESERVED=false
    fi
    echo ""
    
    # Overall status
    if [ "$CAA_FIXED" = true ] && [ "$A_FIXED" = true ] && [ "$AUTH_FIXED" = true ] && [ "$TXT_PRESERVED" = true ]; then
        echo "🎉 ALL DNS RECORDS CORRECT!"
        echo "✅ Ready to proceed with Azure domain reset"
        echo ""
        echo "🚀 Next step: Run ./azure-domain-reset.sh"
        return 0
    else
        echo "⚠️  DNS changes still needed or propagating"
        return 1
    fi
}

# Initial check
if check_dns; then
    exit 0
fi

# If not ready, offer to monitor
echo ""
read -p "🔄 Monitor DNS propagation every 2 minutes? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "💡 Run this script again when you've made the DNS changes"
    echo "📋 Required changes listed in: DNS_CHANGES_REQUIRED.md"
    exit 1
fi

echo ""
echo "🔄 Starting DNS propagation monitoring..."
echo "   (Press Ctrl+C to stop)"
echo ""

# Monitor every 2 minutes
ATTEMPT=1
while true; do
    echo "--- Check #$ATTEMPT ($(date)) ---"
    if check_dns; then
        echo ""
        echo "🎊 DNS propagation complete!"
        echo "🚀 You can now run: ./azure-domain-reset.sh"
        break
    fi
    
    echo "⏳ Waiting 2 minutes before next check..."
    echo ""
    sleep 120
    ATTEMPT=$((ATTEMPT + 1))
done
