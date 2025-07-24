#!/bin/bash

# Array of all public assets
assets=(
    "ProductMockup1.png"
    "ProductMockup2.png"
    "YTThumbnail.png"
    "ai-avatar.png"
    "apple.svg"
    "brand_slide/logo_airbnb.svg"
    "brand_slide/logo_amazon.svg"
    "brand_slide/logo_anthropic.svg"
    "brand_slide/logo_canva.svg"
    "brand_slide/logo_citi.svg"
    "brand_slide/logo_fedex.svg"
    "brand_slide/logo_github.svg"
    "brand_slide/logo_google.svg"
    "brand_slide/logo_meta.svg"
    "brand_slide/logo_microsoft.svg"
    "brand_slide/logo_redis.svg"
    "brand_slide/logo_shopify.svg"
    "brand_slide/logo_steam.svg"
    "brand_slide/logo_tesla.svg"
    "brand_slide/logo_twitch.svg"
    "brand_slide/logo_uber.svg"
    "brand_slide/logo_ups.svg"
    "brand_slide/logo_walmart.svg"
    "calendar.svg"
    "covers/BGFMI1.png"
    "covers/BGFMI2.png"
    "covers/BGFMI3.png"
    "covers/adobe.png"
    "covers/amazon.png"
    "covers/facebook.png"
    "covers/hostinger.png"
    "covers/pinterest.png"
    "covers/quora.png"
    "covers/reddit.png"
    "covers/skype.png"
    "covers/spotify.png"
    "covers/telegram.png"
    "covers/tiktok.png"
    "covers/yahoo.png"
    "default-avatar.svg"
    "demo-screenshot.png"
    "facebook.svg"
    "file.svg"
    "globe.svg"
    "google.svg"
    "logo.svg"
    "logoutIcon.svg"
    "pattern.png"
    "profile.svg"
    "react.svg"
    "robot.png"
    "star.svg"
    "stickyproduct.png"
    "tailwind.svg"
    "tech.svg"
    "upload.svg"
    "user-avatar.svg"
    "window.svg"
)

unused_assets=()

echo "Checking asset usage..."
for asset in "${assets[@]}"; do
    # Check if asset is referenced outside of public/ directory
    found=false
    
    # Use grep to search for the asset in all files except public/
    # Search for both the filename and path-based references
    if grep -r -F "$asset" --exclude-dir=public --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude="check_asset_usage*.sh" . >/dev/null 2>&1; then
        found=true
    elif grep -r -F "/$asset" --exclude-dir=public --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude="check_asset_usage*.sh" . >/dev/null 2>&1; then
        found=true
    fi
    
    if [ "$found" = false ]; then
        echo "UNUSED: $asset"
        unused_assets+=("$asset")
    else
        echo "USED: $asset"
    fi
done

echo ""
echo "Summary of unused assets:"
for asset in "${unused_assets[@]}"; do
    echo "- $asset"
done

echo ""
echo "Total unused assets: ${#unused_assets[@]}"
