import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Activity, Flame } from "lucide-react";

import { getImageForContext } from "@/lib/image-utils";
import { formatTimeAgo, formatFullTimestamp, currentEditionName } from "@/lib/utils";
import { ArticleService } from "@/lib/services/article-service";
import { PoliticianService } from "@/lib/services/politician-service";
import {
    ArticleData,
    getDeskColor,
    LeadHeroSection,
    TrendingSplitSection,
    HeadlinesGridSection,
    InDepthSection,
    ReversedFeatureSection,
} from "@/components/layout/news-sections";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const RATING_LABEL: Record<string, string> = {
    true: "True", mostly_true: "Mostly True", half_true: "Half True", mostly_false: "Mostly False", false: "False", pants_on_fire: "Pants on Fire",
};

async function BorgRecordSidebar() {
    const [featured, rulings] = await Promise.all([PoliticianService.featured(3), PoliticianService.latestRulings(3)]);
    return (
        <div className="bg-primary/5 border border-primary/20 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-sans uppercase font-bold text-sm tracking-wider text-primary">The Borg Record</h2>
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
            </div>
            <div className="flex flex-col gap-5">
                {rulings.length > 0 ? rulings.map(r => (
                    <div key={r.id} className="flex flex-col gap-1 border-b border-primary/10 pb-4">
                        <span className="text-xs text-muted-foreground font-sans flex items-center gap-1"><Flame className="w-3 h-3 text-destructive" /> PolitiFact ruling: {RATING_LABEL[r.rating] || r.rating}</span>
                        <Link href={`/borg-record/politicians/${r.politician_slug}`} className="font-serif font-bold text-lg hover:opacity-70 transition-opacity leading-tight">{r.politician_name}</Link>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">&quot;{r.statement}&quot;</p>
                    </div>
                )) : featured.map(p => (
                    <div key={p.id} className="flex flex-col gap-1 border-b border-primary/10 pb-4">
                        <span className="text-xs text-muted-foreground font-sans">{p.office_held} • {p.district_state}</span>
                        <Link href={`/borg-record/politicians/${p.slug}`} className="font-serif font-bold text-lg hover:opacity-70 transition-opacity leading-tight">{p.name}</Link>
                    </div>
                ))}
                {rulings.length === 0 && featured.length === 0 && (
                    <p className="text-sm text-muted-foreground">The roster is being built from public records right now.</p>
                )}
                <Link href="/borg-record" className="w-full text-center text-sm font-bold font-sans uppercase tracking-wider border border-primary text-primary py-2 mt-2 hover:bg-primary hover:text-primary-foreground transition-colors group flex items-center justify-center gap-2">
                    Open the Record <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
}

function NewsletterSidebar() {
    return (
        <div className="bg-foreground text-background p-6 rounded-sm mt-4">
            <h3 className="font-serif font-bold text-2xl mb-2">The Borg Briefing</h3>
            <p className="text-sm text-background/80 mb-4">The day&apos;s reporting plus alerts on the officials you follow, delivered daily or weekly.</p>
            <Link href="/subscribe" className="block text-center bg-background text-foreground font-bold font-sans uppercase tracking-wider text-sm py-2 hover:bg-background/90 transition-colors">Subscribe</Link>
        </div>
    );
}

export default async function Home() {
    let articles: any[] = [];
    let errorState: string | null = null;
    try {
        articles = await ArticleService.getRecentArticles(32);
    } catch (e: any) {
        errorState = e?.message || "database unavailable";
    }

    if (articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-muted-foreground font-mono uppercase tracking-widest border p-8 bg-muted/10 text-center">
                    {errorState ? "The newsroom database is unreachable right now. Please try again in a minute." : "No verified reporting is live yet. The newsroom publishes throughout the day."}
                </div>
            </div>
        );
    }

    const allStories: ArticleData[] = articles.map(s => ({
        title: s.title,
        desk: s.desk || "Politics",
        timeAgo: formatTimeAgo(s.publish_date),
        fullTimestamp: formatFullTimestamp(s.publish_date),
        excerpt: s.excerpt,
        slug: s.slug,
        readTime: `${s.read_time || 4} min`,
        aiGeneratedImageUrl: s.hero_image_url || null,
        hero_image_url: s.hero_image_url || null,
        article_type: s.article_type || "standard",
        author: s.author_name ? { name: s.author_name } : undefined,
    }));

    const leadStory = allStories[0];
    const sideStories = allStories.slice(1, 3);
    const trendingStories = allStories.slice(3, 5);
    const gridStories = allStories.slice(5, 11);
    const inDepthStory = allStories[11];
    const reversedFeature = allStories[12];
    const extraGridStories = allStories.slice(13, 19);
    const finalListStories = allStories.slice(19, 31);
    const currentEdition = currentEditionName();

    return (
        <div className="flex flex-col min-h-screen relative">
            <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-8">
                <div className="mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
                    <span className="font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground">{currentEdition}</span>
                </div>

                <LeadHeroSection lead={leadStory} sideStories={sideStories} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                    <BorgRecordSidebar />
                    <NewsletterSidebar />
                </div>

                {trendingStories.length >= 2 && <TrendingSplitSection stories={trendingStories} />}
                {gridStories.length > 0 && <HeadlinesGridSection stories={gridStories} />}
                {inDepthStory && <InDepthSection story={inDepthStory} />}
                {reversedFeature && <ReversedFeatureSection story={reversedFeature} />}

                {extraGridStories.length > 0 && (
                    <section className="border-t-2 border-border pt-6 mt-10">
                        <div className="flex items-center gap-2 mb-5"><h2 className="font-sans uppercase font-bold text-xs tracking-widest">From the Desks</h2></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {extraGridStories.map((story, idx) => (
                                <article key={idx} className="border-b border-border pb-4 flex flex-col gap-2">
                                    <Link href={`/${story.desk.toLowerCase()}/${story.slug}`} className="block">
                                        <div className="bg-muted aspect-[16/10] w-full relative overflow-hidden group">
                                            <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        </div>
                                    </Link>
                                    <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)} mt-2`}>{story.desk}</span>
                                    <h3 className="font-serif font-bold text-lg leading-snug hover:opacity-70 transition-opacity"><Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>{story.title}</Link></h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{story.excerpt}</p>
                                    <span className="text-xs text-muted-foreground font-sans">{story.timeAgo}</span>
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                {finalListStories.length > 0 && (
                    <section className="border-t-[6px] border-foreground pt-6 mt-10 mb-10 bg-muted/30 p-8 rounded-sm">
                        <div className="flex items-center gap-2 mb-8">
                            <Activity className="w-5 h-5 text-desk-sports animate-pulse" />
                            <h2 className="font-sans uppercase font-black text-xl tracking-widest">The Daily Wire</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {finalListStories.map((story, idx) => (
                                <article key={idx} className="flex gap-4 border-b border-border/50 pb-4 items-center group">
                                    <div className="text-2xl font-black text-muted-foreground/30 font-sans w-8">{(idx + 1).toString().padStart(2, "0")}</div>
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`uppercase text-[10px] font-bold tracking-wider ${getDeskColor(story.desk)}`}>{story.desk}</span>
                                            <span className="text-[10px] text-muted-foreground font-sans mt-0.5">{story.timeAgo}</span>
                                        </div>
                                        <h3 className="font-serif font-bold text-base leading-snug group-hover:opacity-70 transition-opacity line-clamp-2"><Link href={`/${story.desk.toLowerCase()}/${story.slug}`}>{story.title}</Link></h3>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
