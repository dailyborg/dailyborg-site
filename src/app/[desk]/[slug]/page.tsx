export const runtime = 'edge';

import Link from 'next/link';
import { ArticleService } from '@/lib/services/article-service';
import { notFound } from 'next/navigation';
import { getImageForContext } from '@/lib/image-utils';
import { formatTimeAgo, formatFullTimestamp } from '@/lib/utils';
import { ArticleData, HeadlinesGridSection } from '@/components/layout/news-sections';
import { ClientTime } from '@/components/ui/client-time';

export default async function ArticlePage({ params }: { params: Promise<{ desk: string, slug: string }> }) {
    const resolvedParams = await params;
    const article = await ArticleService.getArticleBySlug(resolvedParams.slug);

    if (!article) {
        notFound();
    }

    const formattedDesk = article.desk || resolvedParams.desk.charAt(0).toUpperCase() + resolvedParams.desk.slice(1);
    
    // Fetch 6 articles for the bottom Headlines Grid
    const sidebarArticles = await ArticleService.getRecentArticles(6);
    
    const moreArticles: ArticleData[] = sidebarArticles.map(s => ({
        title: s.title,
        desk: s.desk || "Intel",
        timeAgo: formatTimeAgo(s.publish_date),
        fullTimestamp: formatFullTimestamp(s.publish_date),
        excerpt: s.excerpt,
        slug: s.slug,
        readTime: `${s.read_time || 4} min`,
        aiGeneratedImageUrl: s.hero_image_url || null,
        hero_image_url: s.hero_image_url || null,
        article_type: s.article_type || 'standard',
    }));

    // Generate fallback or Unsplash image perfectly
    const finalHeroImage = getImageForContext(article);

    // Prepare JSON-LD NewsArticle schema
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "description": article.excerpt,
        "image": [finalHeroImage || "https://dailyborg.com/images/default-news.jpg"],
        "datePublished": article.publish_date,
        "dateModified": article.publish_date,
        "author": [{
            "@type": "Person",
            "name": article.author?.name || "DailyBorg Editorial Team",
            "url": article.author ? `https://dailyborg.com/authors/${article.author.slug}` : "https://dailyborg.com/about"
        }],
        "publisher": {
            "@type": "Organization",
            "name": "DailyBorg",
            "logo": {
                "@type": "ImageObject",
                "url": "https://dailyborg.com/logo.png"
            }
        }
    };

    return (
        <div className="flex flex-col min-h-screen relative overflow-x-hidden">
            {/* Structured Data for Google News */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Full-Width Hero Image - Fixed in Background */}
            {finalHeroImage && (
                <div className="fixed inset-0 z-0 w-full h-[100vh] bg-black">
                    <img src={finalHeroImage} alt={article.title} className="w-full h-full object-cover opacity-80" />
                </div>
            )}

            <main className={`flex-1 w-full mx-auto px-6 md:px-10 lg:px-16 max-w-[1240px] z-10 relative ${
                finalHeroImage 
                ? 'mt-[50vh] md:mt-[60vh] pt-12 md:pt-16 pb-24 bg-white/95 dark:bg-black/95 backdrop-blur-3xl rounded-t-[2.5rem] md:rounded-t-[4rem] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] border-t border-white/20 dark:border-white/10' 
                : 'py-8 md:py-12 bg-background'
            }`}>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

                    {/* Main Article Content (Left Column) */}
                    <article className="lg:col-span-8 flex flex-col gap-8">

                        {/* Lead Image (only show inline if no hero_image_url for the full-width version) */}
                        {!finalHeroImage && (
                            <figure className="w-full">
                                <div className="bg-[#EFEBE6] dark:bg-muted aspect-[16/9] w-full relative overflow-hidden flex items-center justify-center font-[family-name:var(--font-source-sans)] uppercase tracking-widest text-[#9CA3AF] text-[10px] md:text-xs font-bold border border-border">
                                    {`LEAD IMAGE: ${formattedDesk.toUpperCase()}`}
                                </div>
                            </figure>
                        )}

                        {/* Article Header Details */}
                        <header className="flex flex-col gap-6 mt-2">
                            <div className="flex items-center gap-2">
                                <span className="bg-desk-borg text-primary-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">
                                    {formattedDesk}
                                </span>
                                {article.article_type === 'breaking' && (
                                    <span className="bg-destructive text-destructive-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold animate-pulse">
                                        Breaking
                                    </span>
                                )}
                            </div>

                            <h1 className="font-[family-name:var(--font-playfair)] font-black text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
                                {article.title}
                            </h1>

                            <p className="font-[family-name:var(--font-playfair)] font-bold text-xl md:text-2xl text-foreground/90 leading-snug">
                                {article.excerpt}
                            </p>

                            <div className="flex items-center gap-3 font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#64748B] dark:text-muted-foreground pt-4 border-t border-border/50 mt-2">
                                {article.author ? (
                                    <div className="flex items-center gap-2">
                                        <span>BY</span>
                                        <Link href={`/authors/${article.author.slug}`} className="text-foreground hover:text-accent underline underline-offset-2 transition-colors">
                                            {article.author.name.toUpperCase()}
                                        </Link>
                                    </div>
                                ) : (
                                    <span>BY {formattedDesk.toUpperCase()} DESK</span>
                                )}
                                <ClientTime timestamp={article.publish_date} />
                            </div>
                        </header>

                        {/* Article Text */}
                        <div 
                            className="flex flex-col gap-6 text-lg md:text-xl font-[family-name:var(--font-source-sans)] text-foreground/90 leading-relaxed mt-4 prose prose-slate dark:prose-invert max-w-none
                            first-line:uppercase first-line:tracking-widest first-line:text-sm first-line:font-bold
                            drop-cap"
                            dangerouslySetInnerHTML={{ __html: article.content_html }}
                        />

                        {/* Author Bio Footer (E-E-A-T requirement) */}
                        {article.author && (
                            <div className="mt-12 p-8 bg-muted/30 border-2 border-border flex flex-col md:flex-row gap-8 items-start">
                                <div className="w-20 h-20 bg-muted shrink-0 flex items-center justify-center font-[family-name:var(--font-playfair)] text-2xl font-black text-muted-foreground border border-border">
                                    {article.author.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <h4 className="font-[family-name:var(--font-playfair)] font-black text-xl uppercase tracking-tight">
                                            About {article.author.name}
                                        </h4>
                                        <p className="font-[family-name:var(--font-source-sans)] text-sm text-muted-foreground font-bold uppercase tracking-widest">
                                            Political Correspondent
                                        </p>
                                    </div>
                                    <p className="font-[family-name:var(--font-source-sans)] text-base text-foreground/80 leading-relaxed">
                                        {article.author.bio}
                                    </p>
                                    <Link href={`/authors/${article.author.slug}`} className="inline-block font-[family-name:var(--font-source-sans)] text-xs font-black uppercase tracking-widest text-accent hover:underline">
                                        View Full Profile & Work →
                                    </Link>
                                </div>
                            </div>
                        )}

                    </article>

                    {/* Sidebar Content is removed in favor of bottom grid */}
                </div>

                {/* BOTTOM DYNAMIC GRID: More from the Borg */}
                {moreArticles.length > 0 && (
                    <div className="mt-16 pt-12 border-t border-border w-full">
                        <div className="mb-8">
                            <h2 className="font-sans font-black uppercase text-xl md:text-2xl tracking-widest text-foreground">
                                Continue Briefing
                            </h2>
                            <p className="font-serif text-muted-foreground mt-1 text-sm md:text-base">
                                Additional intelligence reports from the network
                            </p>
                        </div>
                        <HeadlinesGridSection stories={moreArticles} />
                    </div>
                )}
            </main>
        </div>
    );
}

