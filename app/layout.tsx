import { Toaster } from "sonner";
import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { UsageProvider } from "@/contexts/UsageContext";
import Providers from "./providers";

import "./globals.css";

const monaSans = Mona_Sans({
    variable: "--font-mona-sans",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "PrepBettr",
    description: "An AI-powered platform for preparing for mock interviews",
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
            <AuthProvider>
                <UsageProvider>
                    {children}
                </UsageProvider>
            </AuthProvider>
        </Providers>

        <Toaster />
        </body>
        </html>
    );
}