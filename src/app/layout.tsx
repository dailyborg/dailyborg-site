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

const SITE_DESCRIPTION =
  "An autonomous newsroom. Stories are written from published reporting, and the Borg Record tracks United States officials using only structured public records.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dailyborg.com"),
  title: { default: "The Daily Borg", template: "%s | The Daily Borg" },
  description: SITE_DESCRIPTION,
  applicationName: "The Daily Borg",
  openGraph: {
    siteName: "The Daily Borg",
    type: "website",
    url: "https://dailyborg.com",
    title: "The Daily Borg",
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "The Daily Borg, Broadcast Operations and Reporting Grid",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Daily Borg",
    description: SITE_DESCRIPTION,
    images: ["/og-default.png"],
  },
  icons: { icon: "/favicon.ico", apple: "/dailyborg-logo-512.png" },
  robots: { index: true, follow: true },
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
