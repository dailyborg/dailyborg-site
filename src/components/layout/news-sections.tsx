import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock, TrendingUp, Zap, BookOpen } from 'lucide-react';
import { getImageForContext } from '@/lib/image-utils';
import { cn, formatTimeAgo, formatFullTimestamp } from '@/lib/utils';

export type ArticleData = {
  title: string;
  desk: string;
  timeAgo: string;
  fullTimestamp?: string;
  excerpt: string;
  slug: string;
  readTime?: string;
  aiGeneratedImageUrl?: string | null;
  hero_image_url?: string | null;
  article_type?: string;
};

// Time formatting functions moved to @/lib/utils

export function getDeskColor(desk: string): string {
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

export function getDeskBgColor(desk: string): string {
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

// =============================================
// SECTION: Lead Hero + Sidebar (Top of Page)
// =============================================
export function LeadHeroSection({ lead, sideStories }: { lead: ArticleData; sideStories: ArticleData[] }) {
  if (!lead) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
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
              <div className="text-sm font-sans">By <span className="font-bold uppercase tracking-wider text-xs">{(lead as any).author?.name || `${lead.desk} Desk`}</span></div>
              <span className="text-muted-foreground mx-1">•</span>
              <span className="text-sm text-muted-foreground font-sans">{lead.fullTimestamp || lead.timeAgo}</span>
              <span className="text-muted-foreground mx-1">•</span>
              <span className="text-sm text-muted-foreground font-sans">{lead.readTime || '5 min'}</span>
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
              <span>{story.fullTimestamp || story.timeAgo}</span>
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
export function TrendingSplitSection({ stories, title = "Trending Now" }: { stories: ArticleData[], title?: string }) {
  if (stories.length < 2) return null;
  const leftStory = stories[0];
  const rightStory = stories[1];

  return (
    <section className="border-t-4 border-foreground pt-6 mt-10">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-destructive" />
        <h2 className="font-sans uppercase font-bold text-xs tracking-widest">{title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
            <span>{leftStory.fullTimestamp || leftStory.timeAgo}</span>
            {leftStory.readTime && <><span className="mx-1">•</span><span>{leftStory.readTime}</span></>}
          </div>
        </article>

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
export function HeadlinesGridSection({ stories, title = "More Headlines" }: { stories: ArticleData[], title?: string }) {
  if (stories.length === 0) return null;

  return (
    <section className="border-t-2 border-border pt-6 mt-10">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-desk-sports" />
        <h2 className="font-sans uppercase font-bold text-xs tracking-widest">{title}</h2>
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
              <span className="text-xs text-muted-foreground font-sans mt-auto">{story.fullTimestamp || story.timeAgo}</span>
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
export function InDepthSection({ story, title = "In Depth" }: { story: ArticleData, title?: string }) {
  if (!story) return null;
  return (
    <section className="border-t-4 border-foreground pt-6 mt-10">
      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="w-4 h-4" />
        <h2 className="font-sans uppercase font-bold text-xs tracking-widest">{title}</h2>
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
            <span>{story.fullTimestamp || story.timeAgo}</span>
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
export function ReversedFeatureSection({ story }: { story: ArticleData }) {
  if (!story) return null;
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
            <span>{story.fullTimestamp || story.timeAgo}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
