import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/tracex/theme-provider";
import { ThemedToaster } from "@/components/tracex/themed-toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TRACE-X // Criminal Intelligence Fusion Dashboard",
  description:
    "AI-powered criminal network analysis for law enforcement — graph fusion, centrality analytics, evidence ingestion and BSA 2023 §63 compliant reporting.",
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${jetbrainsMono.variable} antialiased bg-tracex-bg text-slate-200`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="tracex-theme" disableTransitionOnChange>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
