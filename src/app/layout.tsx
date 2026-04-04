import type { Metadata } from "next";
import { Source_Sans_3, Playfair_Display } from "next/font/google";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: "900",
});

export const metadata: Metadata = {
  title: "The Daily Borg",
  description: "Broadcast Operations & Reporting Grid - The Public Record, Documented.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sourceSans.variable} ${playfair.variable} antialiased bg-background text-foreground selection:bg-accent selection:text-white`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <Suspense fallback={<div className="h-40 w-full" />}>
              <SiteHeader />
            </Suspense>
            <AnalyticsTracker />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
