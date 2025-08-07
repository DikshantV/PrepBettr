import { Toaster } from "sonner";
import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { RouterLoadingHandler } from "@/components/RouterLoadingHandler";
import Providers from "./providers";
import { initializeAzureServices } from '@/lib/azure-startup';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { RetryWithBackoff } from '@/lib/utils/retry-with-backoff';
import { ErrorHandler } from '@/lib/middleware/error-handler';

import "./globals.css";

// Initialize Azure services on server-side
initializeAzureServices();

// Initialize Application Insights with enhanced configuration
let appInsights: ApplicationInsights | null = null;
const instrumentationKey = process.env.NEXT_PUBLIC_APP_INSIGHTS_INSTRUMENTATION_KEY;

if (instrumentationKey && typeof window !== 'undefined') {
  appInsights = new ApplicationInsights({
    config: {
      instrumentationKey,
      enableAutoRouteTracking: true,
      enableCorsCorrelation: true,
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
      distributedTracingMode: 2, // W3C Distributed tracing
      maxBatchInterval: 5000,
      disableFetchTracking: false,
      disableAjaxTracking: false,
      samplingPercentage: 100, // Sample all events in development
      enableUnhandledPromiseRejectionTracking: true
    }
  });
  appInsights.loadAppInsights();
  
  // Set user context
  appInsights.setAuthenticatedUserContext('anonymous');
  
  // Initialize retry logic with Application Insights
  RetryWithBackoff.initialize(instrumentationKey);
  
  // Initialize error handler with Application Insights
  ErrorHandler.initialize(instrumentationKey);
  
  // Track page views
  appInsights.trackPageView({ name: 'PrepBettr Application' });
}

const monaSans = Mona_Sans({
    variable: "--font-mona-sans",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "PrepBettr",
    description: "An AI-powered platform for preparing for mock interviews",
    icons: {
        icon: [
            { url: '/icon', sizes: '512x512', type: 'image/png' },
        ],
        apple: [
            { url: '/apple-icon', sizes: '1024x1024', type: 'image/png' },
        ],
        other: [
            {
                rel: 'icon',
                url: '/favicon.ico',
                sizes: '256x256',
            },
        ],
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
        <body className={`${monaSans.className} antialiased`} style={{ 
          backgroundColor: "#0a0a0a",
          backgroundImage: "url('/pattern.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          "--color-background": "transparent",
          "--background": "transparent"
        } as React.CSSProperties} suppressHydrationWarning={true}>
        <Providers>
            <LoadingProvider>
                <RouterLoadingHandler />
                <AuthProvider>
                    {children}
                </AuthProvider>
            </LoadingProvider>
        </Providers>

        <Toaster />
        </body>
        </html>
    );
}