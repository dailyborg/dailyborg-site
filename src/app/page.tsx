import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, MapPin } from 'lucide-react';

// Contextual Image Router
function getImageForContext(dataPayload: any): string {
  // 1. If the AI actively generated an image for this post
  if (dataPayload.aiGeneratedImageUrl && dataPayload.aiGeneratedImageUrl !== "https://example.com/generated-hero.jpg") {
    return dataPayload.aiGeneratedImageUrl;
  }

  // 2. Fallback to a high-quality relevant Unsplash image based on desk
  const desk = (dataPayload.desk || "Politics").toLowerCase();
  
  const fallbacks: Record<string, string> = {
    politics: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?q=80&w=2070&auto=format&fit=crop",
    business: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
    science: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?q=80&w=2070&auto=format&fit=crop",
    sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=2070&auto=format&fit=crop",
    entertainment: "https://images.unsplash.com/photo-1514525253344-99a343467669?q=80&w=2062&auto=format&fit=crop",
    crime: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=2070&auto=format&fit=crop",
    education: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070&auto=format&fit=crop"
  };

  return fallbacks[desk] || fallbacks.politics;
}

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

type NewsMatrix = {
  leadStory: {
    title: string;
    desk: string;
    location: string;
    author: string;
    readTime: string;
    excerpt: string;
    slug: string;
    category: string;
    primaryPolitician: string;
    emotionalContext: string;
    aiGeneratedImageUrl: string | null;
    severity: number;
    hasHighResHero: boolean;
  };
  secondaryStories: {
    title: string;
    desk: string;
    timeAgo: string;
    excerpt: string;
    slug: string;
    readTime?: string;
  }[];
};

// Layout A: Standard 3-Column Newspaper (Original)
function StandardNewspaperLayout({ data }: { data: NewsMatrix }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
      {/* Left Column - Secondary Stories (col-span-3) */}
      <div className="lg:col-span-3 flex flex-col gap-6 order-2 lg:order-1 border-r-0 lg:border-r border-border pr-0 lg:pr-6">
        <div className="border-b-4 border-foreground pb-2 mb-2">
          <h2 className="font-sans uppercase font-bold text-sm tracking-wider">National Desk</h2>
        </div>

        {data.secondaryStories.slice(0, 2).map((story: any, idx: number) => (
          <article key={idx} className="border-b border-border pb-6 flex flex-col gap-2">
            <span className={`uppercase text-[10px] font-bold tracking-wider ${story.desk === 'Politics' ? 'text-desk-politics' : 'text-desk-business'}`}>{story.desk}</span>
            <h3 className="font-serif font-bold text-xl leading-tight hover:underline cursor-pointer">
              <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
                {story.title}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {story.excerpt}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground font-sans">
              <Clock className="w-3 h-3" />
              <span>{story.timeAgo}</span>
            </div>
          </article>
        ))}
      </div>

      {/* Center Column - Lead Story (col-span-6) */}
      <div className="lg:col-span-6 flex flex-col gap-4 border-r-0 lg:border-r border-border pr-0 lg:pr-6 order-1 lg:order-2">
        <article className="flex flex-col gap-4">
          <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
            {/* Dynamic Contextual Image from Feeder Tags */}
            <Image
              src={getImageForContext(data.leadStory)}
              alt={data.leadStory.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          <div className="flex flex-col gap-3 px-2">
            <div className="flex items-center gap-3">
              <span className="bg-desk-borg text-primary-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">{data.leadStory.desk}</span>
              <span className="text-muted-foreground text-xs font-sans flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {data.leadStory.location}
              </span>
            </div>

            <h2 className="font-[family-name:var(--font-playfair)] font-black text-4xl md:text-5xl leading-tight tracking-tight hover:text-primary transition-colors cursor-pointer">
              <Link href={`/${data.leadStory.desk.toLowerCase()}/${data.leadStory.slug}`}>
                {data.leadStory.title}
              </Link>
            </h2>

            <div className="flex items-center gap-2 mt-1 mb-2">
              <div className="text-sm font-sans">By <span className="font-bold">{data.leadStory.author}</span></div>
              <span className="text-muted-foreground mx-1">•</span>
              <span className="text-sm text-muted-foreground font-sans">{data.leadStory.readTime}</span>
            </div>

            <p className="text-lg text-foreground/80 leading-relaxed font-serif">
              {data.leadStory.excerpt}
            </p>
          </div>
        </article>
      </div>

      {/* Right Column - Borg Record & Newsletter (col-span-3) */}
      <div className="lg:col-span-3 flex flex-col gap-6 order-3">
        <BorgRecordSidebar />
        <NewsletterSidebar />
      </div>
    </div>
  );
}

// Layout B: Hero Focus (2-Column, huge image left)
function HeroFocusLayout({ data }: { data: NewsMatrix }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
      {/* Left Column - Massive Lead Story (col-span-8) */}
      <div className="lg:col-span-8 flex flex-col gap-6 order-1 border-r-0 lg:border-r border-border pr-0 lg:pr-6">
        <div className="bg-[#e9e6df] aspect-[21/9] w-full relative overflow-hidden flex items-center justify-center text-muted-foreground/50 text-xs tracking-widest font-sans uppercase">
          {/* Dynamic Contextual Image from Feeder Tags */}
          <Image
            src={getImageForContext(data.leadStory)}
            alt={data.leadStory.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-4 max-w-3xl flex-1 justify-center">
          <div className="flex items-center gap-3">
            <span className="text-desk-politics font-bold text-[10px] uppercase tracking-wider">Congress</span>
          </div>
          <h2 className="font-[family-name:var(--font-playfair)] font-black text-5xl md:text-6xl leading-[1.1] tracking-tight hover:text-primary transition-colors cursor-pointer">
            <Link href={`/${data.leadStory.desk.toLowerCase()}/${data.leadStory.slug}`}>
              {data.leadStory.title}
            </Link>
          </h2>
          <p className="text-xl text-foreground/80 leading-relaxed font-serif mt-2">
            {data.leadStory.excerpt}
          </p>
        </div>
      </div>

      {/* Right Column - Stacked Secondary Stories (col-span-4) */}
      <div className="lg:col-span-4 flex flex-col gap-6 order-2">
        {data.secondaryStories.slice(2, 5).map((story: any, idx: number) => (
          <article key={idx} className="border-b border-border pb-6 flex flex-col gap-2">
            <span className="uppercase text-[10px] font-bold tracking-wider text-desk-business">{story.desk}</span>
            <h3 className="font-serif font-bold text-2xl leading-tight hover:underline cursor-pointer">
              <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>
                {story.title}
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {story.excerpt}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground font-sans">
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

// Extracted Sidebars for reuse
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
          <Link href="/borg-record/politicians/senator-smith" className="font-serif font-bold text-lg hover:text-primary leading-tight">
            Senator Jane Smith (D-NY) Promise Tracker Adjusted
          </Link>
          <span className="inline-flex mt-1 text-[10px] items-center text-destructive font-bold uppercase tracking-wider">
            Status: Broken
          </span>
        </div>
        <div className="flex flex-col gap-1 border-b border-primary/10 pb-4">
          <span className="text-xs text-muted-foreground font-sans">Key Vote Added</span>
          <Link href="/borg-record/votes/hr-4521" className="font-serif font-bold text-lg hover:text-primary leading-tight">
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
      <h3 className="font-serif font-bold text-2xl mb-2">The Morning Briefing</h3>
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

// MAIN PAGE COMPONENT
export const dynamic = 'force-dynamic'; // Bypass Cloudflare/Next.js caching

export default async function Home() {
  const db = await getDbBinding();

  const { results: rawArticles } = await db.prepare(`
      SELECT * FROM articles 
      WHERE approval_status = 'approved' 
      ORDER BY publish_date DESC 
      LIMIT 8
  `).bind().all();

  const articles = (rawArticles as any[]) || [];

  // Fallback to empty UI if database strictly has literally zero live reports yet
  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground font-mono uppercase tracking-widest border p-8 bg-muted/10">No Intelligence Verified For Broadcast</div>
      </div>
    );
  }

  const dbLead = articles[0];
  const dbSecondary = articles.slice(1);

  // Re-map the raw SQLite results back into the strict React Props shape
  const newsMatrix = {
    leadStory: {
      title: dbLead.title,
      desk: dbLead.desk || "Verification",
      location: "The Grid",
      author: "The Borg Syndicate",
      readTime: `${dbLead.read_time || 5} min read`,
      excerpt: dbLead.excerpt,
      slug: dbLead.slug,
      category: dbLead.article_type || "Politics",
      primaryPolitician: "unknown",
      emotionalContext: "neutral",
      aiGeneratedImageUrl: dbLead.hero_image_url || null,
      severity: dbLead.article_type === 'breaking' ? 5 : 3,
      hasHighResHero: !!dbLead.hero_image_url,
    },
    secondaryStories: dbSecondary.map(s => ({
      title: s.title,
      desk: s.desk || "Intel",
      timeAgo: formatTimeAgo(s.publish_date),
      excerpt: s.excerpt,
      slug: s.slug,
      readTime: `${s.read_time || 4} min`
    }))
  };

  let activeLayout = 'standard';
  let currentEdition = "Morning Briefing";

  // Simulate server time (mocking current time of day)
  const currentHour = new Date().getHours();
  const isEveningEdition = currentHour >= 18 || currentHour < 6; // 6 PM to 6 AM

  if (isEveningEdition) {
    currentEdition = "Evening Edition";
    activeLayout = 'hero_focus'; // Evening defaults to magazine style
  } else {
    currentEdition = "Morning Briefing";
    activeLayout = 'standard'; // Morning defaults to dense grid
  }

  // Override logic based on Content payload
  if (newsMatrix.leadStory.severity === 5) {
    // Earth-shattering news forces the Hero Layout regardless of time
    activeLayout = 'hero_focus';
  } else if (!newsMatrix.leadStory.hasHighResHero && activeLayout === 'hero_focus') {
    // If we wanted Hero Focus but don't have good art, fallback to standard
    activeLayout = 'standard';
  }

  // To prove it works, we can simulate different scenarios by changing the mock object, 
  // but the logic above securely handles the routing decision.

  return (
    <div className="flex flex-col min-h-screen relative">
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-8">

        {/* Edition Indicator (Optional visual cue that algorithm is working) */}
        <div className="mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Algorithmic Matrix Active — {currentEdition}
          </span>
        </div>

        {/* Dynamic Layout Switcher */}
        {activeLayout === 'standard' ? (
          <StandardNewspaperLayout data={newsMatrix} />
        ) : (
          <HeroFocusLayout data={newsMatrix} />
        )}

      </main>
    </div>
  );
}
