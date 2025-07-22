# Dynamic Components for SSR Safety

This directory contains dynamic import wrappers for components that require browser-only APIs (DOM, window, navigator, etc.). These components are disabled during Server-Side Rendering (SSR) and only render on the client side to prevent hydration issues.

## Components

### 1. ResumeTailorDynamic
- **Original**: `components/ResumeTailor.tsx`
- **Browser APIs**: `navigator.clipboard`, `document`, `URL`, `Blob`
- **Purpose**: File upload, clipboard operations, file downloads
- **Loading State**: Animated skeleton matching the original layout

### 2. PdfUploadButtonDynamic  
- **Original**: `components/PdfUploadButtonWrapper.tsx`
- **Browser APIs**: File upload, drag & drop, DOM manipulation
- **Purpose**: PDF file upload with progress tracking
- **Loading State**: Disabled upload button with loading animation

### 3. ProfileFormDynamic
- **Original**: `components/ProfileForm.tsx` 
- **Browser APIs**: `URL.createObjectURL`, `window.location`, file uploads
- **Purpose**: Profile editing with image uploads
- **Loading State**: Form skeleton with disabled state

### 4. GoogleSignInButtonDynamic
- **Original**: `components/GoogleSignInButton.tsx`
- **Browser APIs**: `window.location`, Firebase auth popups
- **Purpose**: Google OAuth sign-in
- **Loading State**: Disabled button with loading animation

## Usage

```tsx
import { ResumeTailorDynamic } from '@/components/dynamic';
// or
import ResumeTailor from '@/components/dynamic/ResumeTailorDynamic';

// Component will automatically handle SSR/client hydration
<ResumeTailor />
```

## Updated Files

The following files were updated to use dynamic imports:

- `app/dashboard/interview/page.tsx` - Uses PdfUploadButtonDynamic
- `app/dashboard/resume-tailor/page.tsx` - Uses ResumeTailorDynamic  
- `app/dashboard/profile/page.tsx` - Uses ProfileFormDynamic
- `components/AuthForm.tsx` - Uses GoogleSignInButtonDynamic
- `components/CodeEditor.tsx` - Uses PdfUploadButtonDynamic

## Benefits

1. **SSR Compatibility**: Prevents hydration mismatches
2. **Better UX**: Shows meaningful loading states
3. **Performance**: Reduces initial bundle size
4. **Maintainability**: Centralized browser-only component handling
