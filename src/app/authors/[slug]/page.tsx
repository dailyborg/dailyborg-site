export const runtime = 'edge';

import type { Metadata } from 'next';
import { AuthorService } from '@/lib/services/author-service';
import { deskFromSlug } from '@/lib/services/article-service';
import { formatFullTimestamp } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Turns a stored desk value into the URL segment the desk routes expect. */
function deskSlug(desk: string | null | undefined): string {
    const raw = (desk || '').toLowerCase().trim().replace(/\s+/g, '-');
    return deskFromSlug(raw) ? raw : 'politics';
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const author = await AuthorService.getAuthorBySlug(slug);
    if (!author) return { title: 'Writer not found' };

    const description = (author.bio || `Reporting published by ${author.name} on The Daily Borg.`).slice(0, 300);
    const canonical = `https://dailyborg.com/authors/${author.slug}`;

    return {
        title: author.name,
        description,
        alternates: { canonical },
        openGraph: {
            type: 'profile',
            url: canonical,
            title: `${author.name} | The Daily Borg`,
            description,
            images: ['/og-default.png'],
        },
        twitter: { card: 'summary_large_image', title: `${author.name} | The Daily Borg`, description, images: ['/og-default.png'] },
    };
}

export default async function AuthorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const author = await AuthorService.getAuthorBySlug(slug);

    if (!author) {
        notFound();
    }

    const articles = await AuthorService.getArticlesByAuthor(author.id);

    return (
        <div className="container max-w-[1000px] mx-auto px-4 py-16 md:py-24">
            <div className="flex flex-col md:flex-row gap-12 items-start border-b-4 border-foreground pb-12 mb-12">
                {/* Author Avatar / Placeholder */}
                <div aria-hidden="true" className="w-32 h-32 md:w-48 md:h-48 bg-muted shrink-0 flex items-center justify-center font-[family-name:var(--font-playfair)] text-4xl font-black text-muted-foreground uppercase tracking-widest border-2 border-border">
                    {author.name.split(' ').map(n => n[0]).join('')}
                </div>

                <div className="space-y-6">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-6xl font-black tracking-tight uppercase leading-none text-foreground">
                        {author.name}
                    </h1>

                    {author.bio && (
                        <p className="font-[family-name:var(--font-source-sans)] text-xl text-foreground leading-relaxed max-w-[700px]">
                            {author.bio}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-6 pt-4 font-[family-name:var(--font-source-sans)] text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        {author.email && (
                            <div className="flex items-center gap-2">
                                <span className="text-foreground">EMAIL:</span>
                                <a href={`mailto:${author.email}`} className="hover:text-accent transition-colors">
                                    {author.email}
                                </a>
                            </div>
                        )}
                        {author.twitter_handle && (
                            <div className="flex items-center gap-2">
                                <span className="text-foreground">X/TWITTER:</span>
                                <a href={`https://twitter.com/${author.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                                    {author.twitter_handle}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Author's Latest Work */}
            <div className="space-y-12">
                <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-black uppercase tracking-tight border-b-2 border-border pb-4 w-fit">
                    Latest Reporting
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {articles.length > 0 ? (
                        articles.map((article) => {
                            const desk = deskSlug(article.desk);
                            const published = formatFullTimestamp(article.publish_date);
                            return (
                                <Link
                                    key={article.id}
                                    href={`/${desk}/${article.slug}`}
                                    className="group flex flex-col gap-4"
                                >
                                    <div className="bg-muted aspect-video w-full relative flex items-center justify-center font-[family-name:var(--font-source-sans)] uppercase tracking-widest text-muted-foreground text-[10px] font-bold border border-border group-hover:border-accent transition-colors overflow-hidden">
                                        {article.hero_image_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={article.hero_image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            `PREVIEW: ${(article.desk || 'Politics').toUpperCase()}`
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-black leading-tight group-hover:text-accent transition-colors">
                                            {article.title}
                                        </h3>
                                        <p className="font-[family-name:var(--font-source-sans)] text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                            {article.excerpt}
                                        </p>
                                        {published && (
                                            <div className="pt-2 font-[family-name:var(--font-source-sans)] text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                {published}
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-lg">
                            <p className="font-[family-name:var(--font-source-sans)] text-muted-foreground uppercase tracking-widest font-bold">
                                No published reporting from this writer yet.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
