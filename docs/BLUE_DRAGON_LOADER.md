# Blue Dragon 70 Loader Component

## Overview

The Blue Dragon 70 loader is a sophisticated animated loading component integrated from [UIverse.io](https://uiverse.io/Nawsome/blue-dragon-70) and adapted for the PrepBettr platform. It features dragon-like aesthetics with smooth CSS animations, responsive design, and full accessibility support.

## Features

- 🐉 **Dragon-inspired Design**: Elegant orbiting elements resembling dragon scales
- 🎨 **Multiple Themes**: Primary (blue), Secondary (purple), Accent (emerald)
- 📱 **Responsive Sizes**: SM, MD, LG, XL variants
- 🌙 **Dark/Light Mode**: Automatic theme adaptation
- ♿ **Accessibility**: ARIA labels and screen reader support
- ⚡ **Performance**: Optimized CSS animations
- 🔧 **Customizable**: Flexible props and styling

## Installation & Usage

### Basic Import

```tsx
import { Loader, LoaderOverlay, LoaderInline } from '@/components/ui/loader';
```

### Basic Usage Examples

```tsx
// Default loader
<Loader />

// With custom text
<Loader text="Loading your data..." />

// Different sizes
<Loader size="sm" />
<Loader size="lg" text="Processing..." />

// Different themes
<Loader variant="secondary" />
<Loader variant="accent" size="xl" />
```

### Advanced Usage Examples

```tsx
// Full-page overlay
<LoaderOverlay 
  text="Analyzing job matches..." 
  backgroundOpacity={90}
  blur={true}
/>

// Inline for buttons
<LoaderInline size="sm" />

// Custom styling
<Loader 
  className="my-4" 
  variant="primary" 
  size="lg"
  ariaLabel="Loading job applications"
/>
```

## Component Variants

### 1. Loader (Main Component)

**Props:**
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Size variant (default: 'md')
- `className?: string` - Custom CSS classes
- `ariaLabel?: string` - Accessibility label (default: 'Loading...')
- `text?: string` - Text to display below loader
- `variant?: 'primary' | 'secondary' | 'accent'` - Theme variant (default: 'primary')

### 2. LoaderOverlay

**Props:** All Loader props plus:
- `backgroundOpacity?: number` - Background opacity 0-100 (default: 80)
- `blur?: boolean` - Enable backdrop blur (default: true)

### 3. LoaderInline

**Props:** All Loader props except `text`
- Optimized for inline contexts like buttons

## Size Specifications

| Size | Container | Orb Size | Text Size |
|------|-----------|----------|-----------|
| sm   | 32px      | 8px      | text-xs   |
| md   | 48px      | 12px     | text-sm   |
| lg   | 64px      | 16px     | text-base |
| xl   | 96px      | 24px     | text-lg   |

## Theme Colors

### Primary (Default)
- **Gradient**: Blue to Indigo
- **Orbs**: Blue-400
- **Glow**: Blue shadow
- **Use Case**: General loading states

### Secondary
- **Gradient**: Purple to Violet
- **Orbs**: Purple-400
- **Glow**: Purple shadow
- **Use Case**: Secondary actions, settings

### Accent
- **Gradient**: Emerald to Cyan
- **Orbs**: Emerald-400
- **Glow**: Emerald shadow
- **Use Case**: Success states, confirmations

## Migration Guide

### Replacing Legacy Loaders

#### Before (Lucide Loader2):
```tsx
import { Loader2 } from 'lucide-react';

// Old implementation
<Loader2 className="h-4 w-4 animate-spin" />
```

#### After (Blue Dragon 70):
```tsx
import { LoaderInline } from '@/components/ui/loader';

// New implementation
<LoaderInline size="sm" />
```

### Common Migration Patterns

#### 1. Button Loading States
```tsx
// Before
{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}

// After
{loading && <LoaderInline size="sm" className="mr-2" />}
```

#### 2. Page Loading States
```tsx
// Before
<div className="flex justify-center items-center h-64">
  <Loader2 className="h-8 w-8 animate-spin" />
</div>

// After
<div className="flex justify-center items-center h-64">
  <Loader size="lg" text="Loading..." />
</div>
```

#### 3. Overlay Loading
```tsx
// Before
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <Loader2 className="h-12 w-12 animate-spin text-white" />
</div>

// After
<LoaderOverlay size="xl" text="Processing your request..." />
```

## Implementation Locations

The Blue Dragon 70 loader should be integrated in the following PrepBettr locations:

### 1. Auto Apply Dashboard
- **File**: `components/AutoApplyDashboard.tsx`
- **Usage**: Job search loading, application processing
- **Implementation**: 
  ```tsx
  {searchLoading && <Loader text="Searching for jobs..." />}
  {loading && <LoaderInline size="sm" />}
  ```

### 2. Job Listing Table
- **File**: `components/JobListingTable.tsx`
- **Usage**: Application status loading
- **Implementation**:
  ```tsx
  {job.applicationStatus === 'applying' && (
    <LoaderInline size="sm" variant="accent" />
  )}
  ```

### 3. Resume Upload
- **File**: `components/ResumeUpload.tsx`
- **Usage**: File upload processing
- **Implementation**:
  ```tsx
  <LoaderOverlay 
    text="Processing your resume..." 
    variant="primary" 
  />
  ```

### 4. Profile Forms
- **File**: `components/ProfileForm.tsx`
- **Usage**: Form submission loading
- **Implementation**:
  ```tsx
  <Loader size="md" text="Updating profile..." />
  ```

### 5. Settings Forms
- **File**: `components/SettingsForm.tsx`
- **Usage**: Settings save operations
- **Implementation**:
  ```tsx
  {loading && <LoaderInline size="sm" />}
  ```

## Accessibility Features

- **ARIA Labels**: Proper labeling for screen readers
- **Role Attributes**: Semantic `role="status"` for loading states
- **Live Regions**: `aria-live="polite"` for dynamic text updates
- **Keyboard Navigation**: Doesn't interfere with tab order
- **High Contrast**: Readable in all theme modes

## Performance Considerations

- **CSS Animations**: Uses hardware-accelerated transforms
- **No JavaScript Animation**: Pure CSS for better performance
- **Optimized Renders**: Minimal re-renders with React.memo potential
- **Small Bundle**: Lightweight component with no external dependencies

## Browser Support

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Common Issues

1. **Animations not working**
   - Ensure `styled-jsx` is installed if using Next.js
   - Check for CSS conflicts with global styles

2. **Theme colors not applying**
   - Verify Tailwind CSS configuration includes all color variants
   - Check for CSS purging issues in production

3. **Accessibility warnings**
   - Ensure proper `ariaLabel` props are provided
   - Test with screen readers

## License

This component is based on the "Blue Dragon 70" loader by Nawsome from UIverse.io, used under the MIT License. The original design has been adapted and enhanced for the PrepBettr platform.

---

**Last Updated**: January 2024  
**Component Version**: 1.0.0  
**Compatibility**: React 18+, Next.js 13+, Tailwind CSS 3+
