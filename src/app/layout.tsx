// Build Trigger: 2026-03-20T00:40:00
import type { Metadata } from "next";
import { Source_Sans_3, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
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

import { getDbBinding } from "@/lib/db";
import { Activity, Landmark } from "lucide-react";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const db = await getDbBinding();
  
  // Fetch latest 10 approved articles for the ticker
  const { results: rawArticles } = await db.prepare(`
    SELECT title, desk, publish_date FROM articles 
    WHERE approval_status = 'approved' 
    ORDER BY publish_date DESC 
    LIMIT 10
  `).bind().all();

  const articles = (rawArticles as any[]) || [];
  const headlines = articles.map(a => `${a.desk?.toUpperCase() || 'UPDATE'}: ${a.title}`);
  
  const liveUpdates = articles.slice(0, 4).map(a => ({
    icon: a.desk === 'Politics' ? Landmark : Activity,
    text: a.title,
    time: "NEW"
  }));

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
            <SiteHeader headlines={headlines.length > 0 ? headlines : undefined} liveUpdates={liveUpdates.length > 0 ? liveUpdates : undefined} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
