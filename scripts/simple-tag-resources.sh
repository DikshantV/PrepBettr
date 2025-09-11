#!/bin/bash

# Simplified Azure Resource Tagging for PrepBettr
# Applies essential tags to all resources for governance and cost tracking

echo "🏷️ Starting Azure resource tagging for PrepBettr..."

# Common tags
TAGS="Environment=Production Application=PrepBettr CostCenter=Engineering Owner=dikshant.vashishtha@prepbettr.com Project=AI-Interview-Platform"

# Get all resource IDs
echo "📦 Discovering resources in PrepBettr_group..."
RESOURCE_IDS=$(az resource list --resource-group PrepBettr_group --query '[].id' -o tsv)

SUCCESS_COUNT=0
FAIL_COUNT=0

for RESOURCE_ID in $RESOURCE_IDS; do
    RESOURCE_NAME=$(basename "$RESOURCE_ID")
    echo "🔖 Tagging: $RESOURCE_NAME"
    
    if az resource tag --ids "$RESOURCE_ID" --tags $TAGS >/dev/null 2>&1; then
        echo "✅ Success: $RESOURCE_NAME"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ Failed: $RESOURCE_NAME"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

# Tag other resource groups
echo -e "\n📦 Tagging production storage..."
az resource tag --ids "/subscriptions/d8a087af-6789-498e-9a5c-ba8f470e11e5/resourceGroups/prepbettr-production-rg/providers/Microsoft.Storage/storageAccounts/prepbettrautoply53848" \
  --tags $TAGS >/dev/null 2>&1 && echo "✅ Production storage tagged"

echo -e "\n📊 Summary:"
echo "✅ Successfully tagged: $SUCCESS_COUNT resources"
echo "❌ Failed to tag: $FAIL_COUNT resources"
echo "🎯 Total processed: $((SUCCESS_COUNT + FAIL_COUNT)) resources"

# Show sample of tagged resources
echo -e "\n🔍 Verification (showing first 5 tagged resources):"
az resource list --resource-group PrepBettr_group --query '[?tags.Environment].{Name:name, Environment:tags.Environment, Application:tags.Application}' -o table | head -6

echo -e "\n✅ Tagging completed!"
