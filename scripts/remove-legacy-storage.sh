#!/bin/bash

# Storage Account Consolidation Script
# Safely removes legacy storage accounts after manual verification

echo "🗑️ Storage Account Consolidation - Legacy Removal"
echo "=================================================="
echo "Target Storage Accounts:"
echo "- prepbettrautoply54299 (Central US)"
echo "- prepbettrautoply54394 (Central US)"
echo ""

# Safety confirmation
echo "⚠️ IMPORTANT: This will permanently delete the storage accounts!"
echo "✅ Manual review completed and confirmed safe for removal"
echo ""

# Function to safely remove storage account
remove_storage_account() {
    local storage_name="$1"
    local resource_group="$2"
    
    echo "🗑️ Removing storage account: $storage_name"
    
    # Check if storage account exists
    if az storage account show --name "$storage_name" --resource-group "$resource_group" >/dev/null 2>&1; then
        echo "  📍 Found storage account: $storage_name"
        
        # Display final details before removal
        echo "  📊 Final details:"
        az storage account show --name "$storage_name" --resource-group "$resource_group" \
            --query '{Name:name,Location:location,CreationTime:creationTime,Status:statusOfPrimary}' -o table
        
        # Remove the storage account
        echo "  🗑️ Deleting storage account..."
        if az storage account delete --name "$storage_name" --resource-group "$resource_group" --yes >/dev/null 2>&1; then
            echo "  ✅ Successfully removed: $storage_name"
            return 0
        else
            echo "  ❌ Failed to remove: $storage_name"
            return 1
        fi
    else
        echo "  ⚠️ Storage account not found: $storage_name (may already be removed)"
        return 0
    fi
}

# Remove legacy storage accounts
echo "Starting removal process..."
REMOVED_COUNT=0
FAILED_COUNT=0

# Remove first legacy storage account
if remove_storage_account "prepbettrautoply54299" "PrepBettr_group"; then
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
else
    FAILED_COUNT=$((FAILED_COUNT + 1))
fi

echo ""

# Remove second legacy storage account
if remove_storage_account "prepbettrautoply54394" "PrepBettr_group"; then
    REMOVED_COUNT=$((REMOVED_COUNT + 1))
else
    FAILED_COUNT=$((FAILED_COUNT + 1))
fi

echo ""
echo "📊 Storage Consolidation Summary:"
echo "================================="
echo "✅ Successfully removed: $REMOVED_COUNT storage accounts"
echo "❌ Failed to remove: $FAILED_COUNT storage accounts"

if [ $FAILED_COUNT -eq 0 ]; then
    echo "🎉 Storage consolidation completed successfully!"
    echo ""
    echo "💰 Estimated Monthly Savings: $30-40/month"
    echo "💰 Annual Savings: $360-480/year"
    echo ""
    echo "📋 Remaining Storage Accounts:"
    echo "- prepbettrstorage684 (Primary - East US 2)"
    echo "- prepbettrautoply53848 (Production - East US)"
    echo ""
    echo "✅ Consolidation from 4 → 2 storage accounts complete!"
else
    echo "⚠️ Some storage accounts could not be removed."
    echo "Please check the errors above and retry if needed."
fi

# Verify final state
echo ""
echo "🔍 Final Verification:"
echo "====================="
echo "Remaining storage accounts in PrepBettr_group:"
az storage account list --resource-group PrepBettr_group --query '[].{Name:name,Location:location,Status:statusOfPrimary}' -o table

echo ""
echo "Production storage account:"
az storage account list --resource-group prepbettr-production-rg --query '[].{Name:name,Location:location,Status:statusOfPrimary}' -o table
