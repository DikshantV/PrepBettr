# Hydration Testing Setup

This document describes the hydration testing setup implemented to detect and prevent hydration mismatches in the Next.js application.

## Overview

Hydration mismatches occur when the server-rendered HTML doesn't match what React expects on the client side. These can cause:
- Console errors and warnings
- Visual glitches
- Runtime errors
- Poor user experience

## Test Coverage

### Automated Tests

The hydration testing is implemented using Playwright and covers:

1. **Public pages** (unauthenticated):
   - Homepage (`/`)
   - Sign-in page (`/sign-in`)
   - Sign-up page (`/sign-up`)
   - Marketing page (`/marketing`)

2. **Authenticated pages**:
   - Dashboard (after login)

3. **Error Detection**:
   - Hydration mismatch errors
   - General console errors
   - React warnings

### Test Files

- `e2e/hydration.spec.ts` - Main hydration testing suite
- `e2e/auth-flow.spec.ts` - Authentication flow tests with hydration checks

## Running Tests

### Local Development

```bash
# Run hydration tests in development mode
npm run test:hydration

# Run with browser visible (helpful for debugging)
npm run test:hydration:headed

# Run in production mode
npm run test:hydration:prod
```

### Build and Test Pipeline

```bash
# Build and run hydration tests together
npm run build:test
```

## CI/CD Integration

### GitHub Actions

The CI pipeline (`.github/workflows/hydration-tests.yml`) includes:

1. **Build verification** - Ensures the app builds successfully
2. **Server startup** - Starts the Next.js application
3. **Hydration testing** - Runs Playwright tests to detect mismatches
4. **Quality gate** - Fails the build if hydration errors are detected

### Pipeline Stages

1. Install dependencies
2. Build the application
3. Start the application server
4. Install Playwright browsers
5. Run hydration tests
6. Upload test results
7. Check results and fail build if errors found

## Common Hydration Issues

### Browser Extensions

**Problem**: Browser extensions (like Grammarly) inject attributes into the DOM that don't exist during server-side rendering.

**Example**:
```
Error: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
- data-new-gr-c-s-check-loaded="14.1245.0"
- data-gr-ext-installed=""
```

**Solutions**:
1. Add `suppressHydrationWarning={true}` to the affected element
2. Use `useEffect` to modify DOM after hydration
3. Detect browser extensions and handle gracefully

### Dynamic Content

**Problem**: Content that changes between server and client (timestamps, random IDs, etc.)

**Solutions**:
1. Use `useEffect` to set dynamic content after hydration
2. Use `suppressHydrationWarning` for specific elements
3. Ensure consistent data between server and client

### Environment Differences

**Problem**: Different behavior between server and client environments

**Solutions**:
1. Use `typeof window !== 'undefined'` checks carefully
2. Ensure consistent environment variables
3. Use Next.js `useRouter` instead of direct window access

## Test Structure

### checkHydrationErrors Function

```javascript
async function checkHydrationErrors(page: Page, url: string = '/') {
  const errors: string[] = [];
  const hydrationErrors: string[] = [];
  const warnings: string[] = [];
  
  // Listen for console messages
  page.on('console', msg => {
    // Categorize console messages
  });

  await page.goto(url);
  await page.waitForTimeout(3000); // Wait for hydration
  
  return { hydrationErrors, generalErrors, warnings };
}
```

### Error Detection Patterns

The tests look for specific error patterns:
- `hydrated but some attributes`
- `Text content did not match`
- `hydration mismatch`
- `Hydration failed because the initial UI`
- `There was an error while hydrating`

## Monitoring and Reporting

### Test Reports

Playwright generates detailed HTML reports that include:
- Screenshots of failures
- Console logs
- Network activity
- Timeline of events

### CI Artifacts

Failed builds upload test artifacts including:
- Playwright HTML reports
- Screenshots of failures
- Error logs and stack traces

## Best Practices

### Development

1. **Run hydration tests frequently** during development
2. **Check console** for hydration warnings in browser dev tools
3. **Test across browsers** as hydration behavior can vary
4. **Use TypeScript** to catch potential hydration issues at build time

### Code Guidelines

1. **Avoid server/client branches** in component render logic
2. **Use `useEffect` for client-only code**
3. **Ensure consistent data shapes** between server and client
4. **Use `suppressHydrationWarning` sparingly** and document why

### Debugging

1. **Use browser dev tools** to inspect hydration errors
2. **Add console.log** statements to trace data flow
3. **Compare server HTML** with client expectations
4. **Run tests with `--headed`** to see browser behavior

## Troubleshooting

### Common Error Messages

**"hydrated but some attributes of the server rendered HTML didn't match"**
- Usually caused by browser extensions
- Check for dynamically added attributes
- Consider suppressing hydration warnings for affected elements

**"Text content did not match"**
- Often caused by timestamps or dynamic content
- Ensure consistent data between server and client
- Use client-side rendering for dynamic content

**"Hydration failed because the initial UI does not match"**
- Component structure differs between server and client
- Check conditional rendering logic
- Ensure consistent component tree

### Debugging Steps

1. Run tests with `--headed` flag to see browser
2. Check browser console for detailed error messages  
3. Compare network tab for data differences
4. Use React Developer Tools to inspect component tree
5. Add temporary `suppressHydrationWarning` to isolate issues

## Maintenance

### Regular Tasks

1. **Update test patterns** as new hydration error types are discovered
2. **Review CI failures** and update tests accordingly
3. **Monitor browser extension compatibility**
4. **Update Playwright** and test browsers regularly

### Version Updates

When updating Next.js or React:
1. Run full hydration test suite
2. Check for new hydration warning patterns
3. Update test matchers if needed
4. Verify CI pipeline still works correctly
