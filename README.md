# PrepBettr - AI-Powered Interview Preparation Platform

Next-generation AI interview platform built with Next.js 15, powered by **Azure AI Foundry Live Voice API** for ultra-low latency (~300-500ms) real-time voice interviews with seamless resume processing.

## Features
- **🎤 Real-time voice interviews** with Azure AI Foundry Live Voice API (STT↔GPT↔TTS)
- **📄 Resume upload and analysis** with AI-powered question generation using Google Gemini
- **🔑 License-based access control** with usage quotas via Dodo Payments
- **🔐 Multi-provider authentication** with Firebase Auth + session management
- **☁️ Hybrid cloud architecture** with Azure primary + Firebase fallback

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
npm run test         # Run tests
npm run type-check   # TypeScript checking
```

## Deployment

### Azure App Service
```bash
npm run build:azure           # Build for Azure App Service
npm run deploy:azure:production  # Deploy to production
```

### Testing
```bash
npm run test:all              # Run all tests
npm run test:e2e             # End-to-end tests
npm run test:voice-flow      # Voice interview tests
```

## Architecture

### Voice Interview System
PrepBettr now uses a **consolidated single-pipeline architecture** powered by Azure AI Foundry:

```
User Speech → Azure AI Foundry Live Voice API → GPT-4o Realtime → TTS → User Audio
             (STT + LLM + TTS in single service, ~300-500ms latency)
```

### Core Technology Stack
- **Frontend**: Next.js 15 with App Router + Tailwind CSS v4
- **Authentication**: Firebase Auth with custom session management
- **Voice Processing**: **Azure AI Foundry Live Voice API** (consolidated pipeline)
- **Storage**: Firebase Firestore + Cloud Storage
- **AI Processing**: Azure OpenAI (GPT-4o) + Google Gemini for resume analysis
- **Backend**: Azure Functions with Firebase fallback
- **Payments**: Dodo Payments license key management
- **Monitoring**: Azure Application Insights

## Documentation

- See `WARP.md` for comprehensive development guidelines
- API documentation in individual route files

## License

Private project - All rights reserved.
