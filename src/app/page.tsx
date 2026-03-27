import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, MapPin, TrendingUp, Zap, BookOpen, Activity } from 'lucide-react';

import { getImageForContext } from '@/lib/image-utils';

import { getDbBinding } from '@/lib/db';

// If we need to polyfill a simple time formatter inline to avoid missing modules:
function formatTimeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getDeskColor(desk: string): string {
  const d = desk?.toLowerCase() || '';
  if (d.includes('politic') || d.includes('congress')) return 'text-desk-politics';
  if (d.includes('crime')) return 'text-desk-crime';
  if (d.includes('business')) return 'text-desk-business';
  if (d.includes('entertain') || d.includes('arts')) return 'text-desk-entertainment';
  if (d.includes('sport')) return 'text-desk-sports';
  if (d.includes('science')) return 'text-desk-science';
  if (d.includes('education')) return 'text-desk-education';
  return 'text-desk-borg';
}

function getDeskBgColor(desk: string): string {
  const d = desk?.toLowerCase() || '';
  if (d.includes('politic') || d.includes('congress')) return 'bg-desk-politics';
  if (d.includes('crime')) return 'bg-desk-crime';
  if (d.includes('business')) return 'bg-desk-business';
  if (d.includes('entertain') || d.includes('arts')) return 'bg-desk-entertainment';
  if (d.includes('sport')) return 'bg-desk-sports';
  if (d.includes('science')) return 'bg-desk-science';
  if (d.includes('education')) return 'bg-desk-education';
  return 'bg-desk-borg';
}

type ArticleData = {
  title: string;
  desk: string;
  timeAgo: string;
  excerpt: string;
  slug: string;
  readTime?: string;
  aiGeneratedImageUrl?: string | null;
  hero_image_url?: string | null;
  article_type?: string;
};

// =============================================
// SECTION: Lead Hero + Sidebar (Top of Page)
// =============================================
function LeadHeroSection({ lead, sideStories }: { lead: ArticleData; sideStories: ArticleData[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
      {/* Center Column - Lead Story (col-span-8) */}
      <div className="lg:col-span-8 flex flex-col gap-4 border-r-0 lg:border-r border-border pr-0 lg:pr-6">
        <article className="flex flex-col gap-4">
          <Link href={`/${lead.desk.toLowerCase()}/${lead.slug}`} className="block">
            <div className="bg-muted aspect-[16/9] w-full relative overflow-hidden group">
              <Image
                src={getImageForContext(lead)}
                alt={lead.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </Link>

          <div className="flex flex-col gap-3 px-2">
            <div className="flex items-center gap-3">
              <span className={`${getDeskBgColor(lead.desk)} text-white px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold`}>{lead.desk}</span>
            </div>

            <h2 className="font-[family-name:var(--font-playfair)] font-black text-4xl md:text-5xl leading-tight tracking-tight hover:opacity-70 transition-opacity cursor-pointer">
              <Link href={`/${lead.desk.toLowerCase()}/${lead.slug}`}>
                {lead.title}
              </Link>
            </h2>

            <div className="flex items-center gap-2 mt-1 mb-1">
              <div className="text-sm font-sans">By <span className="font-bold">The Borg Syndicate</span></div>
              <span className="text-muted-foreground mx-1">•</span>
              <span className="text-sm text-muted-foreground font-sans">{lead.readTime}</span>
            </div>

            <p className="text-xl text-foreground mt-2 leading-relaxed font-serif line-clamp-6">
              {lead.excerpt}
            </p>

            <Link href={`/${lead.desk.toLowerCase()}/${lead.slug}`} className="inline-flex items-center gap-1 text-sm font-sans font-bold uppercase tracking-wider hover:opacity-70 transition-opacity mt-4 text-foreground">
              Continue reading <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </article>
      </div>

      {/* Right Column - Stacked Side Stories (col-span-4) */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {sideStories.map((story, idx) => (
          <article key={idx} className="border-b border-border pb-5 flex flex-col gap-2">
            <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)}`}>{story.desk}</span>
            <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="block">
              <div className="bg-muted aspect-[3/2] w-full relative mb-1 overflow-hidden">
                <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover transition-transform hover:scale-105 duration-500" />
              </div>
            </Link>
            <h3 className="font-serif font-bold text-xl leading-tight hover:opacity-70 transition-opacity cursor-pointer">
              <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
                {story.title}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {story.excerpt}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-sans">
              <Clock className="w-3 h-3" />
              <span>{story.timeAgo}</span>
              {story.readTime && (
                <>
                  <span className="text-muted-foreground mx-1">•</span>
                  <span>{story.readTime}</span>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// =============================================
// SECTION: Trending Split (2-col: text left, image right)
// =============================================
function TrendingSplitSection({ stories }: { stories: ArticleData[] }) {
  if (stories.length < 2) return null;
  const leftStory = stories[0];
  const rightStory = stories[1];

  return (
    <section className="border-t-4 border-foreground pt-6 mt-10">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-destructive" />
        <h2 className="font-sans uppercase font-bold text-xs tracking-widest">Trending Now</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: text-heavy article */}
        <article className="flex flex-col gap-3 border-r-0 md:border-r border-border pr-0 md:pr-6">
          <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(leftStory.desk)}`}>{leftStory.desk}</span>
          <h3 className="font-serif font-bold text-3xl leading-tight hover:opacity-70 transition-opacity cursor-pointer">
            <Link href={`/${leftStory.desk.toLowerCase()}/${leftStory.slug}`}>
              {leftStory.title}
            </Link>
          </h3>
          <p className="text-base text-foreground/75 leading-relaxed font-serif line-clamp-4">
            {leftStory.excerpt}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans mt-1">
            <Clock className="w-3 h-3" />
            <span>{leftStory.timeAgo}</span>
            {leftStory.readTime && <><span className="mx-1">•</span><span>{leftStory.readTime}</span></>}
          </div>
        </article>

        {/* Right: image-heavy article */}
        <article className="flex flex-col gap-3">
          <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(rightStory.desk)}`}>{rightStory.desk}</span>
          <Link href={`/${rightStory.desk.toLowerCase()}/${rightStory.slug}`} className="block">
            <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
              <Image src={getImageForContext(rightStory)} alt={rightStory.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
          </Link>
          <h3 className="font-serif font-bold text-2xl leading-tight hover:opacity-70 transition-opacity cursor-pointer">
            <Link href={`/${rightStory.desk.toLowerCase()}/${rightStory.slug}`}>
              {rightStory.title}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{rightStory.excerpt}</p>
        </article>
      </div>
    </section>
  );
}

// =============================================
// SECTION: Headlines Grid (3-col compact)
// =============================================
function HeadlinesGridSection({ stories }: { stories: ArticleData[] }) {
  if (stories.length === 0) return null;

  return (
    <section className="border-t-2 border-border pt-6 mt-10">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-desk-sports" />
        <h2 className="font-sans uppercase font-bold text-xs tracking-widest">More Headlines</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stories.map((story, idx) => (
          <article key={idx} className="flex gap-4 border-b border-border pb-4">
            <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="flex-shrink-0 block">
              <div className="bg-muted w-24 h-24 relative overflow-hidden">
                <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover transition-transform hover:scale-105 duration-500" />
              </div>
            </Link>
            <div className="flex flex-col gap-1 min-w-0">
              <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)}`}>{story.desk}</span>
              <h3 className="font-serif font-bold text-base leading-snug hover:opacity-70 transition-opacity cursor-pointer line-clamp-3">
                <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
                  {story.title}
                </Link>
              </h3>
              <span className="text-xs text-muted-foreground font-sans mt-auto">{story.readTime || '4 min'}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// =============================================
// SECTION: In-Depth Feature (full-width)
// =============================================
function InDepthSection({ story }: { story: ArticleData }) {
  return (
    <section className="border-t-4 border-foreground pt-6 mt-10">
      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="w-4 h-4" />
        <h2 className="font-sans uppercase font-bold text-xs tracking-widest">In Depth</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="flex flex-col gap-3">
          <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)}`}>{story.desk}</span>
          <h3 className="font-[family-name:var(--font-playfair)] font-black text-3xl md:text-4xl leading-tight hover:opacity-70 transition-opacity cursor-pointer">
            <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
              {story.title}
            </Link>
          </h3>
          <p className="text-base text-foreground/75 leading-relaxed font-serif">
            {story.excerpt}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans mt-2">
            <Clock className="w-3 h-3" />
            <span>{story.timeAgo}</span>
            {story.readTime && <><span className="mx-1">•</span><span>{story.readTime}</span></>}
          </div>
          <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="inline-flex items-center gap-1 text-sm font-sans font-bold uppercase tracking-wider hover:opacity-70 transition-opacity mt-2 text-foreground">
            Read full analysis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="block">
          <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
            <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
          </div>
        </Link>
      </div>
    </section>
  );
}

// =============================================
// SECTION: Second Feature Row (reversed: image left, text right)
// =============================================
function ReversedFeatureSection({ story }: { story: ArticleData }) {
  return (
    <section className="border-t-2 border-border pt-6 mt-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="block order-2 md:order-1">
          <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
            <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
          </div>
        </Link>

        <div className="flex flex-col gap-3 order-1 md:order-2">
          <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)}`}>{story.desk}</span>
          <h3 className="font-[family-name:var(--font-playfair)] font-black text-3xl leading-tight hover:opacity-70 transition-opacity cursor-pointer">
            <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
              {story.title}
            </Link>
          </h3>
          <p className="text-base text-foreground/75 leading-relaxed font-serif line-clamp-4">
            {story.excerpt}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans mt-1">
            <Clock className="w-3 h-3" />
            <span>{story.timeAgo}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

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
