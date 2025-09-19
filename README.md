# PrepBettr - AI-Powered Interview Preparation Platform

AI-powered interview platform built with Next.js 15, Azure Speech Services, Azure OpenAI, and Firebase for real-time voice interviews and resume processing.

## Features
- **Real-time voice interviews** with Azure Speech-to-Text and Text-to-Speech
- **Resume upload and analysis** with AI-powered question generation  
- **License-based access control** with usage quotas
- **Multi-provider authentication** with Firebase
- **Azure-first architecture** with Firebase fallback

## Quick Start

### Prerequisites
- Node.js 20.x or later
- Azure account with Speech Services and OpenAI
- Firebase project with Auth, Firestore, and Storage

### Installation
```bash
git clone https://github.com/yourusername/prepbettr.git
cd prepbettr
npm install
cp .env.example .env.local  # Configure your environment variables
npm run dev
```

### Environment Setup
Copy `.env.example` to `.env.local` and configure:
- Azure Speech Services (key, region, endpoint)
- Azure OpenAI (key, endpoint, deployment name) 
- Firebase config (API key, project ID, etc.)

See `.env.example` for all required variables.

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build  
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:coverage # Run tests with coverage
npm run type-check   # TypeScript checking
npm run check:routes # Check for duplicate API routes
```

## Deployment

### Azure App Service
```bash
npm run build:azure           # Build for Azure App Service
npm run deploy:azure:production  # Deploy to production
```

### Testing
```bash
npm run test                 # Unit tests with Jest
npm run test:coverage        # Unit tests with coverage report
npm run test:e2e             # End-to-end tests with Playwright
npm run test:e2e:dev         # E2E tests with UI mode
npm run test:azure-health    # Azure services health check
```

## Architecture

- **Frontend**: Next.js 15 with App Router
- **Authentication**: Firebase Auth with session management
- **Voice Services**: Azure Speech Services + Azure OpenAI
- **Storage**: Firebase Firestore + Cloud Storage
- **AI Processing**: Azure OpenAI (GPT-4) + Google Gemini
- **Payments**: Dodo Payments license key system

## Documentation

- See `WARP.md` for comprehensive development guidelines
- API documentation in individual route files
- See `CLEANUP_REPORT.md` for recent cleanup and maintenance activities

## Project Status

- **Build Status**: ✅ Production ready (23.0s build time)
- **Route Health**: ✅ 38 endpoints, no duplicates
- **Dependencies**: Recently cleaned up and modernized
- **Code Quality**: Comprehensive cleanup completed January 2025

## License

Private project - All rights reserved.
