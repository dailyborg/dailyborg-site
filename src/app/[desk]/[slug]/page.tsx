export const runtime = 'edge';

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleService } from '@/lib/services/article-service';
import { notFound } from 'next/navigation';
import { getImageForContext } from '@/lib/image-utils';
import { formatTimeAgo, formatFullTimestamp } from '@/lib/utils';
import { ArticleData, HeadlinesGridSection, imageAlt } from '@/components/layout/news-sections';
import { ClientTime } from '@/components/ui/client-time';
import CommentSection from '@/components/CommentSection';

/** D1 stores "YYYY-MM-DD HH:MM:SS" in UTC. Search engines want ISO 8601. */
function toIsoDate(dbDate: string | undefined | null): string {
    if (!dbDate) return '';
    const s = String(dbDate);
    if (s.endsWith('Z')) return s;
    if (s.includes('T')) return `${s}Z`;
    return `${s.replace(' ', 'T')}Z`;
}

export async function generateMetadata({ params }: { params: Promise<{ desk: string, slug: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const article = await ArticleService.getArticleBySlug(resolvedParams.slug);
    if (!article) return { title: 'Story not found' };

    const deskSlug = (article.desk || resolvedParams.desk).toLowerCase();
    const canonical = `https://dailyborg.com/${deskSlug}/${article.slug}`;
    const description = (article.excerpt || '').slice(0, 300);
    const ogImage = article.hero_image_url && article.hero_image_url.startsWith('http')
        ? article.hero_image_url
        : '/og-default.png';

    return {
        title: article.title,
        description,
        alternates: { canonical },
        openGraph: {
            type: 'article',
            url: canonical,
            title: article.title,
            description,
            images: [ogImage],
            publishedTime: toIsoDate(article.publish_date),
            modifiedTime: toIsoDate(article.publish_date),
            authors: article.author?.name ? [article.author.name] : undefined,
            section: article.desk || undefined,
        },
        twitter: { card: 'summary_large_image', title: article.title, description, images: [ogImage] },
    };
}

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
        desk: s.desk || "Politics",
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
    const heroAlt = imageAlt(article, finalHeroImage);
    const publishedIso = toIsoDate(article.publish_date);

    // Prepare JSON-LD NewsArticle schema
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "description": article.excerpt,
        "image": [finalHeroImage || "https://dailyborg.com/og-default.png"],
        "datePublished": publishedIso,
        "dateModified": publishedIso,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://dailyborg.com/${(article.desk || resolvedParams.desk).toLowerCase()}/${article.slug}`
        },
        "author": [{
            "@type": "Person",
            "name": article.author?.name || "The Daily Borg Newsroom",
            "url": article.author ? `https://dailyborg.com/authors/${article.author.slug}` : "https://dailyborg.com/about"
        }],
        "publisher": {
            "@type": "Organization",
            "name": "The Daily Borg",
            "logo": {
                "@type": "ImageObject",
                "url": "https://dailyborg.com/dailyborg-logo-512.png"
            }
        }
    };

    return (
        <div className="flex flex-col min-h-screen relative overflow-x-hidden bg-background">
            {/* Structured Data for Google News */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Full-Width Hero Image - Fixed in Background */}
            {finalHeroImage && (
                <div className="fixed inset-0 z-0 w-full h-[100vh] bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={finalHeroImage} alt={heroAlt} className="w-full h-full object-cover opacity-60" />
                </div>
            )}

            {/* STAGE 1: Glassmorphic Preview Splash (Scrolls away natively) */}
            {finalHeroImage && (
                <div className="relative z-10 w-full h-[100vh] flex flex-col items-center justify-center px-4 md:px-8">
                    <div className="max-w-4xl w-full bg-white/10 dark:bg-black/40 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 md:p-14 text-center shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div className="flex justify-center items-center gap-3 mb-6">
                            <span className="bg-primary text-primary-foreground px-3 py-1 text-[10px] md:text-xs uppercase tracking-widest font-black">
                                {formattedDesk}
                            </span>
                            {article.article_type === 'breaking' && (
                                <span className="bg-destructive text-destructive-foreground px-3 py-1 text-[10px] md:text-xs uppercase tracking-widest font-black animate-pulse">
                                    Breaking
                                </span>
                            )}
                        </div>
                        <h1 className="font-[family-name:var(--font-playfair)] font-black text-4xl md:text-5xl lg:text-6xl text-white tracking-tight leading-[1.1] mb-6 drop-shadow-md">
                            {article.title}
                        </h1>
                        <p className="font-[family-name:var(--font-playfair)] font-bold text-xl md:text-2xl text-white leading-snug max-w-2xl mx-auto drop-shadow-sm">
                            {article.excerpt}
                        </p>

                        <div className="flex items-center justify-center gap-3 font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold uppercase tracking-widest text-white pt-8 mt-6 border-t border-white/20">
                            {article.author ? (
                                <span>BY {article.author.name.toUpperCase()}</span>
                            ) : (
                                <span>BY {formattedDesk.toUpperCase()} DESK</span>
                            )}
                            <ClientTime timestamp={article.publish_date} />
                        </div>

                        <a href="#article-body" className="mt-12 inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-white/90 hover:scale-105 transition-all shadow-lg">
                            Read Full Article
                            <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        </a>
                    </div>
                </div>
            )}

            {/* STAGE 2: Main Article Reading Area (Below Fold) */}
            <div id="article-body" className={`flex-1 w-full mx-auto px-6 md:px-10 lg:px-16 max-w-[900px] z-20 relative bg-background ${finalHeroImage
                ? 'pt-16 md:pt-24 pb-24 shadow-[0_-30px_60px_rgba(0,0,0,0.6)] border-t border-border/50'
                : 'py-8 md:py-12'
                }`}>

                <div className="flex flex-col gap-12 lg:gap-16">

                    {/* Main Article Content */}
                    <article className="flex flex-col gap-8">

                        {/* If NO Hero Image, show standard header */}
                        {!finalHeroImage && (
                            <header className="flex flex-col gap-6 mt-2">
                                <div className="flex items-center gap-2">
                                    <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">
                                        {formattedDesk}
                                    </span>
                                </div>
                                <h1 className="font-[family-name:var(--font-playfair)] font-black text-5xl md:text-6xl text-foreground tracking-tight leading-[1.05]">
                                    {article.title}
                                </h1>
                                <p className="font-[family-name:var(--font-playfair)] font-bold text-xl md:text-2xl text-foreground/90 leading-snug">
                                    {article.excerpt}
                                </p>
                                <div className="flex items-center gap-3 font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground pt-4 border-t border-border/50 mt-2">
                                    {article.author ? (
                                        <span>BY {article.author.name.toUpperCase()}</span>
                                    ) : (
                                        <span>BY {formattedDesk.toUpperCase()} DESK</span>
                                    )}
                                    <ClientTime timestamp={article.publish_date} />
                                </div>
                            </header>
                        )}

                        {/* Article Text */}
                        <div
                            className="flex flex-col gap-6 text-lg md:text-xl font-[family-name:var(--font-source-sans)] text-foreground leading-relaxed mt-4 prose prose-slate dark:prose-invert max-w-none
                            first-line:uppercase first-line:tracking-widest first-line:text-sm first-line:font-bold
                            drop-cap"
                            dangerouslySetInnerHTML={{ __html: article.content_html }}
                        />

                        {/* Author footer. Name and bio only, nothing we cannot back up. */}
                        {article.author && (
                            <div className="mt-12 p-8 bg-muted/30 border-2 border-border flex flex-col md:flex-row gap-8 items-start">
                                <div aria-hidden="true" className="w-20 h-20 bg-muted shrink-0 flex items-center justify-center font-[family-name:var(--font-playfair)] text-2xl font-black text-muted-foreground border border-border">
                                    {article.author.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className="space-y-4">
                                    <h2 className="font-[family-name:var(--font-playfair)] font-black text-xl uppercase tracking-tight">
                                        About {article.author.name}
                                    </h2>
                                    {article.author.bio && (
                                        <p className="font-[family-name:var(--font-source-sans)] text-base text-foreground leading-relaxed">
                                            {article.author.bio}
                                        </p>
                                    )}
                                    <Link href={`/authors/${article.author.slug}`} className="inline-block font-[family-name:var(--font-source-sans)] text-xs font-black uppercase tracking-widest text-accent hover:underline">
                                        View full profile and work
                                    </Link>
                                </div>
                            </div>
                        )}

                    </article>

                    <CommentSection pageType="article" pageSlug={article.slug} />
                </div>

                {/* BOTTOM DYNAMIC GRID: More from the Borg */}
                {moreArticles.length > 0 && (
                    <div className="mt-16 w-full">
                        <HeadlinesGridSection stories={moreArticles} title="More of today's reporting" />
                    </div>
                )}
            </div>
        </div>
    );
}
