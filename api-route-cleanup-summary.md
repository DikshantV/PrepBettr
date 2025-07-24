# API Route Analysis & Cleanup Summary

## Routes Analyzed: 31 total

### Active Routes (25 remaining in app/api/):
- **Payments** (2): `/api/payments/create-checkout`, `/api/payments/portal-link` 
- **Auth** (6): `/api/auth/resend-verification`, `/api/auth/signup`, `/api/auth/signout`, `/api/auth/verify-email`, `/api/auth/signin`, `/api/auth/verify-credentials`
- **Admin** (3): `/api/admin/subscriptions`, `/api/admin/users/[userId]/actions`, `/api/admin/analytics`
- **Usage** (3): `/api/usage/init`, `/api/usage/increment`, `/api/usage/check`
- **Auto-apply** (3): `/api/auto-apply/apply`, `/api/auto-apply/search`, `/api/auto-apply/analyze`
- **Subscription** (2): `/api/subscription/migrate`, `/api/subscription/current`
- **Profile** (3): `/api/profile/update`, `/api/profile/logout`, `/api/profile/me`
- **Other** (3): `/api/upload-profile-pic`, `/api/webhooks/dodo`, `/api/vapi/generate`

### Unused Routes (6 moved to __trash__/api/):
1. **`/api/resume-tailor/analyze`** - Only found in test files, no component usage
2. **`/api/resume-tailor/upload`** - Only found in test files, no component usage  
3. **`/api/license/validate`** - Only self-referencing imports, no active usage
4. **`/api/license/activate`** - Only self-referencing imports, no active usage
5. **`/api/test/email-license-flow`** - Test endpoint only, not for production
6. **`/api/protected/user-profile`** - Only mentioned in docs, no active code usage

## Analysis Method:
1. Found all route.ts files with `find app/api -name route.ts`
2. Searched for references using `grep` for each API path pattern
3. Cross-referenced with component usage and documentation
4. Moved unused routes to `__trash__/api/` maintaining directory structure
5. Cleaned up empty directories

## Notes:
- The license validation system appears to be using Dodo Payments instead of direct license API routes
- Resume tailor functionality may have been replaced by other features
- Test endpoints were safely moved as they're not needed in production
- All webhook, payment, auth, admin, usage, and auto-apply routes are actively used
