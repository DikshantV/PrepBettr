import { Toaster } from "sonner";
import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { RouterLoadingHandler } from "@/components/RouterLoadingHandler";
import { TelemetryProvider } from "@/components/providers/TelemetryProvider";
import Providers from "./providers";
import { initializeAzureServices } from '@/lib/azure-startup';
import { RetryWithBackoff } from '@/lib/utils/retry-with-backoff';
import { ErrorHandler } from '@/lib/middleware/error-handler';
import FirebaseClientInit from "@/components/FirebaseClientInit";

import "./globals.css";
import TestHelperInitializer from "@/components/test/TestHelperInitializer";

// Initialize Azure services on server-side
// initializeAzureServices(); // Temporarily disabled for testing

// Initialize retry logic and error handler with Application Insights
const instrumentationKey = process.env.NEXT_PUBLIC_AZURE_APPLICATION_INSIGHTS_INSTRUMENTATION_KEY;

if (instrumentationKey) {
  RetryWithBackoff.initialize(instrumentationKey);
  ErrorHandler.initialize(instrumentationKey);
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
                <TelemetryProvider>
                    <FirebaseClientInit>
                        {/* TestHelperInitializer for E2E tests */}
                        {(process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_TESTING === 'true') && <TestHelperInitializer />}
                        {children}
                    </FirebaseClientInit>
                </TelemetryProvider>
            </LoadingProvider>
        </Providers>

        <Toaster />
        </body>
        </html>
    );
}