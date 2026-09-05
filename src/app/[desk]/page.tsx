export const runtime = 'edge';

import { notFound } from "next/navigation";
import { ArticleService, deskFromSlug } from '@/lib/services/article-service';
import { formatTimeAgo, formatFullTimestamp } from '@/lib/utils';
import {
    ArticleData,
    LeadHeroSection,
    TrendingSplitSection,
    HeadlinesGridSection,
    InDepthSection,
    ReversedFeatureSection
} from '@/components/layout/news-sections';
import CommentSection from '@/components/CommentSection';

const SUBSECTIONS: Record<string, string[]> = {
    politics: ["All", "White House", "Congress", "Federal Agencies", "Campaigns & Elections", "State of the Race", "Policy Tracker"],
    crime: ["All", "Breaking Crime", "Courts & Justice", "Public Safety", "Investigations", "Major Cases"],
    business: ["All", "Economy", "Markets", "Startups", "Mergers & Acquisitions", "Labor", "Policy & Regulation"],
    entertainment: ["All", "Film & TV", "Music", "Celebrity", "Streaming", "Culture", "Viral Internet"],
    sports: ["All", "Headlines", "Scores", "Trades", "College Sports", "Pro Sports"],
    science: ["All", "Space", "Health Research", "Climate", "Physics", "Biology", "Tech Science"],
    education: ["All", "Standardized Testing", "Education Funding", "Curriculum Reform", "School Technology", "Higher Education", "K-12 Policy"]
};

export default async function DeskPage({ params }: { params: Promise<{ desk: string }> }) {
    const resolvedParams = await params;
    const desk = resolvedParams.desk.toLowerCase();
    const deskName = deskFromSlug(desk);
    if (!deskName) notFound();

    const tabs = SUBSECTIONS[desk] || ["All"];

    // Exact desk match on the (desk, publish_date) index, cached for two minutes.
    let articles: any[] = [];
    try {
        articles = await ArticleService.getDeskArticles(deskName, 32);
    } catch {
        articles = [];
    }

    const deskTitle = desk === 'crime' ? 'Crime & Justice' : deskName;

    if (articles.length === 0) {
        return (
            <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-muted-foreground font-mono uppercase tracking-widest border p-8 bg-muted/10">
                    No published reporting on the {deskTitle} desk yet
                </div>
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
    const subsectionArticles = allStories.slice(13);

    return (
        <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12 min-h-screen">
            <div className="flex flex-col gap-6 border-b border-border pb-0 mb-8">
                <div className="flex justify-between items-end pb-4 border-b-4 border-foreground">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">{deskTitle}</h1>
                    <span className="font-[family-name:var(--font-source-sans)] text-xs font-bold text-accent uppercase tracking-[0.2em] hidden md:inline-block">The Daily Borg</span>
                </div>
                <div className="w-full overflow-x-auto no-scrollbar">
                    <div className="flex gap-8 whitespace-nowrap px-2">
                        {tabs.map((tab, idx) => (
                            <span key={idx} className={`font-[family-name:var(--font-source-sans)] text-[11px] font-bold uppercase tracking-widest pb-3 ${idx === 0 ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground'}`}>
                                {tab}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {leadStory && <LeadHeroSection lead={leadStory} sideStories={sideStories} />}
            {trendingStories.length >= 2 && <TrendingSplitSection stories={trendingStories} title={`Trending in ${deskTitle}`} />}
            {gridStories.length > 0 && <HeadlinesGridSection stories={gridStories} title={`More ${deskTitle} Headlines`} />}
            {inDepthStory && <InDepthSection story={inDepthStory} title={`${deskTitle} In Depth`} />}
            {reversedFeature && <ReversedFeatureSection story={reversedFeature} />}

            {tabs.length > 1 && subsectionArticles.length > 0 && (
                <div className="flex flex-col gap-6 pb-16">
                    {tabs.filter(t => t !== "All").slice(0, Math.ceil(subsectionArticles.length / 3)).map((subsection, idx) => {
                        const rowArticles = subsectionArticles.slice(idx * 3, (idx * 3) + 3);
                        if (rowArticles.length === 0) return null;
                        return <HeadlinesGridSection key={idx} stories={rowArticles} title={subsection} />;
                    })}
                </div>
            )}

            <CommentSection pageType="article" pageSlug={desk} />
        </div>
    );
}
