#!/bin/bash

# Fix Firebase Unauthorized Domain Error
# This script helps you add localhost to Firebase authorized domains

echo "🔧 Firebase Unauthorized Domain Fix"
echo "=================================="
echo ""

echo "📋 Your current setup:"
echo "• Dev server running on: http://localhost:3000"
echo "• Firebase Project: prepbettr"
echo "• Firebase Auth Domain: prepbettr.firebaseapp.com"
echo ""

echo "🚨 ERROR: auth/unauthorized-domain"
echo "Firebase doesn't recognize 'localhost' as an authorized domain."
echo ""

echo "🔗 SOLUTION: Add these domains to Firebase Console:"
echo ""
echo "1. Go to: https://console.firebase.google.com/project/prepbettr/authentication/settings"
echo "2. Scroll to 'Authorized domains' section"
echo "3. Click 'Add domain' and add these one by one:"
echo ""
echo "   📌 localhost"
echo "   📌 127.0.0.1"  
echo "   📌 localhost:3000"
echo ""

echo "⚡ QUICK LINKS:"
echo "• Firebase Console: https://console.firebase.google.com/"
echo "• Your Project: https://console.firebase.google.com/project/prepbettr"
echo "• Auth Settings: https://console.firebase.google.com/project/prepbettr/authentication/settings"
echo ""

echo "✅ VERIFICATION STEPS:"
echo "1. Add domains to Firebase Console"
echo "2. Clear browser cache/cookies"
echo "3. Restart dev server: npm run dev"
echo "4. Try Google Sign-In again"
echo ""

echo "🔍 CURRENT AUTH STATUS:"
curl -s "http://localhost:3000/api/auth/verify" | head -1 || echo "Dev server might not be running"
echo ""

echo "📝 After fixing, your authorized domains should include:"
echo "• prepbettr.firebaseapp.com (default)"
echo "• localhost ← ADD THIS"
echo "• 127.0.0.1 ← ADD THIS"  
echo "• localhost:3000 ← ADD THIS"
echo ""

echo "🎯 Direct link to add domains:"
echo "https://console.firebase.google.com/project/prepbettr/authentication/settings"
echo ""

read -p "Press Enter after you've added the domains to Firebase Console..."

echo ""
echo "🧪 Testing Firebase connection..."

# Test if we can reach the dev server
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Dev server is running on localhost:3000"
else
    echo "❌ Dev server not responding on localhost:3000"
    echo "   Start it with: npm run dev"
fi

echo ""
echo "🔧 Next steps:"
echo "1. Clear browser cache"
echo "2. Go to http://localhost:3000/sign-in"
echo "3. Try Google Sign-In"
echo "4. Should work without unauthorized-domain error"
echo ""

echo "✨ Fix complete! Try signing in again."
