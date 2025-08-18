#!/bin/bash

# Domain validation monitoring script
# Run this daily while waiting for Azure support resolution

echo "🔍 Monitoring PrepBettr Domain Validation Status - $(date)"
echo "=================================================="

echo ""
echo "📊 AZURE STATIC WEB APP STATUS:"
az staticwebapp hostname list \
  --name prepbettr-swa \
  --resource-group PrepBettr_group \
  --query "[].{Domain:domainName, Status:status, Error:errorMessage, Created:createdOn}" \
  --output table

echo ""
echo "🌐 DNS PROPAGATION CHECK:"
echo "A Records:"
dig prepbettr.com A +short

echo ""
echo "TXT Records:"
dig prepbettr.com TXT +short

echo ""
echo "CNAME Record:"
dig www.prepbettr.com CNAME +short

echo ""
echo "🔗 CONNECTIVITY TEST:"
echo "Default domain:"
curl -I https://jolly-cliff-0244e530f.2.azurestaticapps.net --connect-timeout 5 2>/dev/null | head -n 1 || echo "❌ Failed"

echo ""
echo "Custom domain:"
curl -I https://prepbettr.com --connect-timeout 5 2>/dev/null | head -n 1 || echo "❌ Failed (expected while validation pending)"

echo ""
echo "📅 NEXT STEPS:"
echo "• Check Azure support ticket status"
echo "• If validation completes, SSL certificates will auto-provision"
echo "• Expected resolution: 24-48 hours from ticket submission"

echo ""
echo "=================================================="
