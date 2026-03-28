export const runtime = 'edge';

import Link from 'next/link';
import { ArticleService } from '@/lib/services/article-service';
import { notFound } from 'next/navigation';

export default async function ArticlePage({ params }: { params: Promise<{ desk: string, slug: string }> }) {
    const resolvedParams = await params;
    const article = await ArticleService.getArticleBySlug(resolvedParams.slug);

    if (!article) {
        notFound();
    }

    const formattedDesk = article.desk || resolvedParams.desk.charAt(0).toUpperCase() + resolvedParams.desk.slice(1);
    
    // Fetch some recent articles for the sidebar
    const sidebarArticles = await ArticleService.getRecentArticles(5);

    // Prepare JSON-LD NewsArticle schema
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "description": article.excerpt,
        "image": [article.hero_image_url || "https://dailyborg.com/images/default-news.jpg"],
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
        <div className="flex flex-col min-h-screen bg-background relative">
            {/* Structured Data for Google News */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Full-Width Hero Image (breaks out of content container) */}
            {article.hero_image_url && (
                <div className="w-full bg-[#EFEBE6] dark:bg-muted aspect-[21/9] relative overflow-hidden">
                    <img src={article.hero_image_url} alt={article.title} className="w-full h-full object-cover" />
                </div>
            )}

            <main className="flex-1 w-full mx-auto px-4 md:px-6 py-8 md:py-12 max-w-[1200px]">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

                    {/* Main Article Content (Left Column) */}
                    <article className="lg:col-span-8 flex flex-col gap-8">

                        {/* Lead Image (only show inline if no hero_image_url for the full-width version) */}
                        {!article.hero_image_url && (
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

                            <div className="flex items-center gap-3 font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#64748B] dark:text-muted-foreground pt-4 border-t border-border mt-2">
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
                                <span>{new Date(article.publish_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
                                <span>•</span>
                                <span>{new Date(article.publish_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()}</span>
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

                    {/* Sidebar Content (Right Column) */}
                    <aside className="lg:col-span-4 flex flex-col">
                        <div className="flex flex-col gap-0 border-t border-border lg:border-t-0">
                            <h3 className="font-[family-name:var(--font-source-sans)] font-black text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
                                Latest Reports
                            </h3>
                            {sidebarArticles.map((s, idx) => (
                                <Link 
                                    key={s.id} 
                                    href={`/${s.desk.toLowerCase().replace(' ', '-')}/${s.slug}`}
                                    className="flex flex-col gap-3 py-6 border-b border-border border-dashed lg:border-solid lg:border-b-2 lg:first:pt-0 group cursor-pointer"
                                >
                                    <div className="font-[family-name:var(--font-source-sans)] text-[10px] font-black uppercase tracking-widest text-desk-politics">
                                        {s.desk}
                                    </div>
                                    <h4 className="font-[family-name:var(--font-playfair)] text-xl font-bold leading-tight text-[#0f172a] dark:text-slate-100 group-hover:underline underline-offset-4 decoration-2">
                                        {s.title}
                                    </h4>
                                    <p className="font-[family-name:var(--font-source-sans)] text-sm text-[#64748B] dark:text-slate-400 line-clamp-2">
                                        {s.excerpt}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </aside>

                </div>
            </main>
        </div>
    );
}

