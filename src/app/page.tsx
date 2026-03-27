import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, MapPin, TrendingUp, Zap, BookOpen, Activity } from 'lucide-react';

import { getImageForContext } from '@/lib/image-utils';

import { getDbBinding } from '@/lib/db';

import { 
  ArticleData, 
  formatTimeAgo, 
  getDeskColor, 
  LeadHeroSection, 
  TrendingSplitSection, 
  HeadlinesGridSection, 
  InDepthSection, 
  ReversedFeatureSection 
} from '@/components/layout/news-sections';

// =============================================
// Extracted Sidebars (unchanged)
// =============================================
function BorgRecordSidebar() {
  return (
    <div className="bg-primary/5 border border-primary/20 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-sans uppercase font-bold text-sm tracking-wider text-primary">The Borg Record</h2>
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 border-b border-primary/10 pb-4">
          <span className="text-xs text-muted-foreground font-sans">Just Updated</span>
          <Link href="/borg-record/politicians/senator-smith" className="font-serif font-bold text-lg hover:opacity-70 transition-opacity leading-tight">
            Senator Jane Smith (D-NY) Promise Tracker Adjusted
          </Link>
          <span className="inline-flex mt-1 text-[10px] items-center text-destructive font-bold uppercase tracking-wider">
            Status: Broken
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-primary/10 pb-4">
          <span className="text-xs text-muted-foreground font-sans">Key Vote Added</span>
          <Link href="/borg-record/votes/hr-4521" className="font-serif font-bold text-lg hover:opacity-70 transition-opacity leading-tight">
            H.R. 4521: Clean Energy Procurement Act
          </Link>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">Complete roll call data now available in the public grid.</p>
        </div>
        <Link href="/borg-record" className="w-full text-center text-sm font-bold font-sans uppercase tracking-wider border border-primary text-primary py-2 mt-2 hover:bg-primary hover:text-primary-foreground transition-colors group flex items-center justify-center gap-2">
          Access Full Database <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function NewsletterSidebar() {
  return (
    <div className="bg-foreground text-background p-6 rounded-sm mt-4">
      <h3 className="font-serif font-bold text-2xl mb-2">The Borg Briefing</h3>
      <p className="text-sm text-background/80 mb-4">Unfiltered intelligence from the grid, delivered daily.</p>
      <div className="flex flex-col gap-2">
        <input type="email" placeholder="Your email address" className="bg-background/10 border border-background/20 px-3 py-2 text-sm text-background placeholder:text-background/50 focus:outline-none focus:border-background transition-colors" />
        <button className="bg-background text-foreground font-bold font-sans uppercase tracking-wider text-sm py-2 hover:bg-background/90 transition-colors">
          Subscribe
        </button>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE COMPONENT
// =============================================
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default async function Home() {

  const articles: any[] = [];
  let errorState: string | null = null;

  try {
    const db = await getDbBinding();
    const { results } = await db.prepare(`
        SELECT * FROM articles 
        WHERE approval_status = 'approved' 
        ORDER BY publish_date DESC 
        LIMIT 32
    `).bind().all();

    if (results) articles.push(...(results as any[]));
  } catch (e: any) {
    errorState = e.message;
  }

  // Fallback to empty UI if database strictly has literally zero live reports yet
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-muted-foreground font-mono uppercase tracking-widest border p-8 bg-muted/10">
          {errorState ? `Grid Error: ${errorState}` : "No Intelligence Verified For Broadcast"}
        </div>
        {errorState && (
          <Link href="/debug" className="text-xs text-primary underline">Run Diagnostic</Link>
        )}
      </div>
    );
  }

  // Map all articles into a common shape
  const allStories: ArticleData[] = articles.map(s => ({
    title: s.title,
    desk: s.desk || "Intel",
    timeAgo: formatTimeAgo(s.publish_date),
    excerpt: s.excerpt,
    slug: s.slug,
    readTime: `${s.read_time || 4} min`,
    aiGeneratedImageUrl: s.hero_image_url || null,
    hero_image_url: s.hero_image_url || null,
    article_type: s.article_type || 'standard',
  }));

  // Distribute articles across sections
  const leadStory = allStories[0];
  const sideStories = allStories.slice(1, 3);      // 2 side stories to avoid dead space
  const trendingStories = allStories.slice(3, 5);   // 2 trending stories
  const gridStories = allStories.slice(5, 11);      // 6 headline grid stories
  const inDepthStory = allStories[11];               // 1 in-depth feature
  const reversedFeature = allStories[12];             // 1 reversed feature
  const extraGridStories = allStories.slice(13, 19); // 6 more grid stories
  const finalListStories = allStories.slice(19, 31); // Up to 12 simple list stories

  // Edition logic
  let currentEdition = "Morning Borg Edition";
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 12) currentEdition = "Morning Borg Edition";
  else if (currentHour >= 12 && currentHour < 17) currentEdition = "Afternoon Borg Edition";
  else if (currentHour >= 17 && currentHour < 21) currentEdition = "Evening Borg Edition";
  else currentEdition = "Nightly Borg Edition";

  return (
    <div className="flex flex-col min-h-screen relative">
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-8">

        {/* Edition Indicator */}
        <div className="mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {currentEdition}
          </span>
        </div>

        {/* === SECTION 1: Lead Hero + Sidebar === */}
        <LeadHeroSection lead={leadStory} sideStories={sideStories} />

        {/* === Borg Record + Newsletter (below fold on mobile, inline on desktop hidden in hero) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 lg:hidden">
          <BorgRecordSidebar />
          <NewsletterSidebar />
        </div>

        {/* === SECTION 2: Trending Now (2-col split) === */}
        {trendingStories.length >= 2 && (
          <TrendingSplitSection stories={trendingStories} />
        )}

        {/* === SECTION 3: Headlines Grid (3-col compact) === */}
        {gridStories.length > 0 && (
          <HeadlinesGridSection stories={gridStories} />
        )}

        {/* === SECTION 4: In-Depth Feature (full-width) === */}
        {inDepthStory && (
          <InDepthSection story={inDepthStory} />
        )}

        {/* === SECTION 5: Reversed Feature === */}
        {reversedFeature && (
          <ReversedFeatureSection story={reversedFeature} />
        )}

        {/* === SECTION 6: More Headlines Grid === */}
        {extraGridStories.length > 0 && (
          <section className="border-t-2 border-border pt-6 mt-10">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="font-sans uppercase font-bold text-xs tracking-widest">From the Desks</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {extraGridStories.map((story, idx) => (
                <article key={idx} className="border-b border-border pb-4 flex flex-col gap-2">
                  <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="block">
                    <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
                      <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                  </Link>
                  <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)} mt-2`}>{story.desk}</span>
                  <h3 className="font-serif font-bold text-lg leading-snug hover:opacity-70 transition-opacity cursor-pointer">
                    <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
                      {story.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{story.excerpt}</p>
                  <span className="text-xs text-muted-foreground font-sans">{story.timeAgo}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* === SECTION 7: The Wire (Compact List) === */}
        {finalListStories.length > 0 && (
          <section className="border-t-[6px] border-foreground pt-6 mt-10 mb-10 bg-muted/30 p-8 rounded-sm">
            <div className="flex items-center gap-2 mb-8">
              <Activity className="w-5 h-5 text-desk-sports animate-pulse" />
              <h2 className="font-sans uppercase font-black text-xl tracking-widest">The Daily Wire</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              {finalListStories.map((story, idx) => (
                <article key={idx} className="flex gap-4 border-b border-border/50 pb-4 items-center group">
                  <div className="text-2xl font-black text-muted-foreground/30 font-sans w-8">
                    {(idx + 1).toString().padStart(2, '0')}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)}`}>{story.desk}</span>
                      <span className="text-[10px] text-muted-foreground font-sans mt-0.5">{story.timeAgo}</span>
                    </div>
                    <h3 className="font-serif font-bold text-base leading-snug group-hover:opacity-70 transition-opacity cursor-pointer line-clamp-2">
                       <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
                         {story.title}
                       </Link>
                    </h3>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Borg Record sidebar (desktop: floating side panel after hero) */}
        {/* This only shows on desktop via CSS, since mobile gets it above */}

      </main>
    </div>
  );
}
