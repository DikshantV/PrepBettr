# Manual Testing Guide - Dashboard Responsiveness

## Prerequisites
- Development server running on localhost:3000
- Chrome browser with DevTools access
- User authenticated and able to access dashboard

## Step 1: Dashboard Responsiveness Testing

### Testing at Different Viewport Widths:

#### 1. Mobile View (320px width)
1. Open Chrome DevTools (F12)
2. Click the device toolbar icon (mobile/tablet view)
3. Set custom dimensions: 320px x 568px
4. Navigate to `/dashboard`
5. Verify:
   - Navigation menu collapses appropriately
   - Cards stack vertically
   - Text remains readable
   - No horizontal scrolling
   - Touch targets are at least 44px
   - All buttons and links are accessible

#### 2. Tablet View (768px width)
1. Set dimensions to 768px x 1024px
2. Navigate to `/dashboard`
3. Verify:
   - Layout adapts to tablet view
   - Sidebar may collapse or remain visible
   - Cards may be in 2-column layout
   - Navigation remains accessible
   - All interactive elements work properly

#### 3. Desktop View (1280px width)
1. Set dimensions to 1280px x 800px
2. Navigate to `/dashboard`
3. Verify:
   - Full desktop layout displays
   - Sidebar fully expanded
   - Multi-column layouts work properly
   - All features are accessible
   - Hover states work correctly

### Testing Breakpoints:
- Verify smooth transitions between breakpoints
- Check layout stability when resizing
- Ensure no content is cut off or overlapping

## Step 2: Marketing Page Loader Testing

### Slow-3G Network Throttling:
1. Open Chrome DevTools
2. Go to Network tab
3. Set throttling to "Slow 3G"
4. Navigate to `/marketing` page
5. Verify:
   - Loader appears immediately
   - Loader displays for at least 500ms
   - Smooth transition from loader to content
   - No flash of unstyled content (FOUC)

### Performance Testing:
- Record the loader display duration
- Verify loader animation is smooth even on slow network
- Check that critical content loads first

## Expected Results:
- ✅ All viewport sizes display correctly
- ✅ No horizontal scrolling on mobile
- ✅ Interactive elements remain accessible
- ✅ Marketing loader displays for ≥500ms
- ✅ Smooth transitions between states

## Common Issues to Look For:
- Text too small on mobile
- Buttons too small for touch
- Layout breaking at specific widths
- Missing or broken responsive images
- Loader not displaying long enough
- Content shifting after load
