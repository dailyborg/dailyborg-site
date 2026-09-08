export const runtime = 'edge';

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArticleService, deskFromSlug } from '@/lib/services/article-service';
import { getImageForContext } from '@/lib/image-utils';
import { formatTimeAgo, formatFullTimestamp } from '@/lib/utils';
import {
    ArticleData,
    getDeskColor,
    imageAlt,
    LeadHeroSection,
    TrendingSplitSection,
    HeadlinesGridSection,
    InDepthSection,
    ReversedFeatureSection
} from '@/components/layout/news-sections';

function deskTitleFor(slug: string, deskName: string) {
    return slug === 'crime' ? 'Crime & Justice' : deskName;
}

export async function generateMetadata({ params }: { params: Promise<{ desk: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const slug = resolvedParams.desk.toLowerCase();
    const deskName = deskFromSlug(slug);
    if (!deskName) return { title: 'Desk not found' };

    const title = deskTitleFor(slug, deskName);
    const description = `The latest ${title} reporting from The Daily Borg, written from published reporting and updated through the day.`;
    const canonical = `https://dailyborg.com/${slug}`;

    return {
        title,
        description,
        alternates: { canonical },
        openGraph: {
            type: 'website',
            url: canonical,
            title: `${title} | The Daily Borg`,
            description,
            images: ['/og-default.png'],
        },
        twitter: { card: 'summary_large_image', title: `${title} | The Daily Borg`, description, images: ['/og-default.png'] },
    };
}

export default async function DeskPage({ params }: { params: Promise<{ desk: string }> }) {
    const resolvedParams = await params;
    const desk = resolvedParams.desk.toLowerCase();
    const deskName = deskFromSlug(desk);
    if (!deskName) notFound();

    // Exact desk match on the (desk, publish_date) index, cached for two minutes.
    let articles: any[] = [];
    try {
        articles = await ArticleService.getDeskArticles(deskName, 32);
    } catch {
        articles = [];
    }

    const deskTitle = deskTitleFor(desk, deskName);

    if (articles.length === 0) {
        return (
            <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-6xl font-black tracking-tight uppercase leading-none text-center">{deskTitle}</h1>
                <p className="text-muted-foreground font-sans uppercase tracking-widest border border-border p-8 bg-muted/30 text-center">
                    No published reporting on the {deskTitle} desk yet
                </p>
            </div>
        );
    }

    const allStories: ArticleData[] = articles.map(s => ({
        title: s.title,
        desk: s.desk || deskName,
        timeAgo: formatTimeAgo(s.publish_date),
        fullTimestamp: formatFullTimestamp(s.publish_date),
        excerpt: s.excerpt,
        slug: s.slug,
        readTime: `${s.read_time || 4} min`,
        aiGeneratedImageUrl: s.hero_image_url || null,
        hero_image_url: s.hero_image_url || null,
        article_type: s.article_type || 'standard',
    }));

    const leadStory = allStories[0];
    const sideStories = allStories.slice(1, 3);
    const trendingStories = allStories.slice(3, 5);
    const gridStories = allStories.slice(5, 11);
    const inDepthStory = allStories[11];
    const reversedFeature = allStories[12];
    const remainingStories = allStories.slice(13);

    return (
        <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12 min-h-screen">
            <div className="flex flex-col gap-6 border-b border-border pb-0 mb-8">
                <div className="flex justify-between items-end pb-4 border-b-4 border-foreground">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">{deskTitle}</h1>
                    <span className="font-[family-name:var(--font-source-sans)] text-xs font-bold text-accent uppercase tracking-[0.2em] hidden md:inline-block">The Daily Borg</span>
                </div>
            </div>

            {leadStory && <LeadHeroSection lead={leadStory} sideStories={sideStories} priority />}
            {trendingStories.length >= 2 && <TrendingSplitSection stories={trendingStories} title={`Trending in ${deskTitle}`} />}
            {gridStories.length > 0 && <HeadlinesGridSection stories={gridStories} title={`More ${deskTitle} Headlines`} />}
            {inDepthStory && <InDepthSection story={inDepthStory} title={`${deskTitle} In Depth`} />}
            {reversedFeature && <ReversedFeatureSection story={reversedFeature} />}

            {remainingStories.length > 0 && (
                <section className="border-t-2 border-border pt-6">
                    <h2 className="font-sans uppercase font-bold text-xs tracking-widest mb-5">Latest in {deskTitle}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-16">
                        {remainingStories.map((story) => {
                            const src = getImageForContext(story);
                            return (
                                <article key={story.slug} className="border-b border-border pb-4 flex flex-col gap-2">
                                    <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="block">
                                        <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
                                            <Image src={src} alt={imageAlt(story, src)} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        </div>
                                    </Link>
                                    <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)} mt-2`}>{story.desk}</span>
                                    <h3 className="font-serif font-bold text-lg leading-snug hover:opacity-70 transition-opacity">
                                        <Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>{story.title}</Link>
                                    </h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{story.excerpt}</p>
                                    <span className="text-xs text-muted-foreground font-sans">{story.fullTimestamp || story.timeAgo}</span>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
