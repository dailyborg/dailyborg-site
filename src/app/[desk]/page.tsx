export const runtime = 'edge';

import { NewsGrid } from "@/components/ui/grid";
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from "next/navigation";
import { getDbBinding } from '@/lib/db';
import { getImageForContext } from '@/lib/image-utils';

const VALID_DESKS = ["politics", "crime", "business", "entertainment", "sports", "science", "education"];

const SUBSECTIONS: Record<string, string[]> = {
    politics: ["All", "White House", "Congress", "Federal Agencies", "Campaigns & Elections", "State of the Race", "Policy Tracker"],
    crime: ["All", "Breaking Crime", "Courts & Justice", "Public Safety", "Investigations", "Major Cases"],
    business: ["All", "Economy", "Markets", "Startups", "Mergers & Acquisitions", "Labor", "Policy & Regulation"],
    entertainment: ["All", "Film & TV", "Music", "Celebrity", "Streaming", "Culture", "Viral Internet"],
    sports: ["All", "Headlines", "Scores", "Trades", "College Sports", "Pro Sports"],
    science: ["All", "Space", "Health Research", "Climate", "Physics", "Biology", "Tech Science"],
    education: ["All", "Standardized Testing", "Education Funding", "Curriculum Reform", "School Technology", "Higher Education", "K-12 Policy"]
};

function formatTimeAgo(dateString: string) {
    const diff = Date.now() - new Date(dateString).getTime();
    if (isNaN(diff)) return "Just now";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default async function DeskPage({ params }: { params: Promise<{ desk: string }> }) {
    const resolvedParams = await params;
    const desk = resolvedParams.desk.toLowerCase();

    if (!VALID_DESKS.includes(desk)) {
        notFound();
    }

    const tabs = SUBSECTIONS[desk] || ["All"];
    
    // Fetch live data from D1
    const articles: any[] = [];
    try {
        const db = await getDbBinding();
        const { results } = await db.prepare(`
            SELECT * FROM articles 
            WHERE LOWER(desk) LIKE ? AND approval_status = 'approved' 
            ORDER BY publish_date DESC 
            LIMIT 20
        `).bind(`%${desk}%`).all();
        if (results) articles.push(...(results as any[]));
    } catch (e) {
        // Fallback to empty
    }

    if (articles.length === 0) {
        return (
            <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 flex flex-col items-center justify-center min-h-[60vh]">
                <div className="text-muted-foreground font-mono uppercase tracking-widest border p-8 bg-muted/10">
                    No Intelligence Verified For {desk.toUpperCase()} Desk
                </div>
            </div>
        );
    }

    const leadArticle = articles[0];
    const secondaryArticles = articles.slice(1, 5);
    const gridArticles = articles.slice(5);

    const deskTitle = desk === 'crime' ? 'Crime & Justice' : desk.charAt(0).toUpperCase() + desk.slice(1);

    return (
        <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12 min-h-screen">

            {/* Header Area */}
            <div className="flex flex-col gap-6 border-b border-border pb-0">
                <div className="flex justify-between items-end pb-4 border-b-4 border-foreground">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">{deskTitle}</h1>
                    <span className="font-[family-name:var(--font-source-sans)] text-xs font-bold text-accent uppercase tracking-[0.2em] hidden md:inline-block">The Daily Borg</span>
                </div>

                {/* Subsections Tab Navigation */}
                <div className="w-full overflow-x-auto no-scrollbar">
                    <div className="flex gap-8 whitespace-nowrap px-2">
                        {tabs.map((tab, idx) => (
                            <span
                                key={idx}
                                className={`font-[family-name:var(--font-source-sans)] text-[11px] font-bold uppercase tracking-widest pb-3 cursor-pointer hover:text-foreground transition-colors ${idx === 0 ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground'}`}
                            >
                                {tab}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <NewsGrid>
                {/* Lead Desk Story */}
                <div className="col-span-1 md:col-span-4 lg:col-span-8 flex flex-col gap-6 group cursor-pointer max-w-4xl">
                    <Link href={`/${desk}/${leadArticle.slug}`} className="aspect-[21/9] bg-muted border border-border relative overflow-hidden flex items-center justify-center">
                        <Image src={getImageForContext(leadArticle)} alt={leadArticle.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                    </Link>
                    <div className="flex flex-col gap-3">
                        <Link href={`/${desk}/${leadArticle.slug}`}>
                            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-6xl font-black leading-[1.1] tracking-tight hover:text-accent transition-colors">
                                {leadArticle.title}
                            </h2>
                        </Link>
                        <p className="text-xl md:text-2xl text-muted-foreground font-[family-name:var(--font-playfair)] leading-relaxed mt-2 line-clamp-3">
                            {leadArticle.excerpt}
                        </p>
                    </div>
                    <div className="font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-4 mt-2">
                        <span>By The Borg Syndicate</span>
                        <span>•</span>
                        <span>{formatTimeAgo(leadArticle.publish_date)}</span>
                    </div>
                </div>

                {/* Supporting News Sidebar */}
                <div className="col-span-1 md:col-span-4 lg:col-span-4 flex flex-col gap-8 md:pl-8 md:border-l border-border mt-8 md:mt-0">
                    {secondaryArticles.map((story: any, i: number) => (
                        <div key={i} className="group cursor-pointer flex flex-col gap-3">
                            <span className="font-[family-name:var(--font-source-sans)] block text-[10px] font-bold text-accent uppercase tracking-wider mb-0">
                                {story.article_type || "Intel"}
                            </span>
                            <div className="aspect-[16/9] bg-muted relative overflow-hidden w-full">
                                <Image src={getImageForContext(story)} alt={story.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <Link href={`/${desk}/${story.slug}`}>
                                <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-black mb-2 group-hover:underline underline-offset-4 decoration-2 leading-tight tracking-tight mt-2">
                                    {story.title}
                                </h3>
                                <p className="font-[family-name:var(--font-source-sans)] text-sm md:text-base text-muted-foreground mb-4 leading-relaxed line-clamp-2">
                                    {story.excerpt}
                                </p>
                            </Link>
                            {i < secondaryArticles.length - 1 && <hr className="mt-4 border-border" />}
                        </div>
                    ))}
                </div>
            </NewsGrid>

            {/* Subsections Content Rows (If enough articles exist) */}
            {tabs.length > 1 && gridArticles.length > 0 && (
                <div className="flex flex-col gap-16 mt-20 pb-16">
                    {tabs.filter(t => t !== "All").slice(0, Math.ceil(gridArticles.length / 3)).map((subsection, idx) => {
                        const rowArticles = gridArticles.slice(idx * 3, (idx * 3) + 3);
                        if (rowArticles.length === 0) return null;
                        
                        return (
                            <div key={idx} className="flex flex-col gap-8">
                                {/* Row Header */}
                                <div className="border-t-2 border-border pt-4 flex flex-col md:flex-row md:justify-between md:items-end gap-2">
                                    <h3 className="font-[family-name:var(--font-playfair)] text-3xl md:text-4xl font-black uppercase tracking-tight">{subsection}</h3>
                                    <div className="font-[family-name:var(--font-source-sans)] text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest font-bold">
                                        More from the {desk} desk
                                    </div>
                                </div>

                                {/* Row Stories Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {rowArticles.map((item, idxx) => (
                                        <div key={idxx} className="flex flex-col gap-4 group cursor-pointer group">
                                            <div className="aspect-[4/3] bg-muted border border-border relative overflow-hidden">
                                                 <Image src={getImageForContext(item)} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Link href={`/${desk}/${item.slug}`}>
                                                    <h4 className="font-[family-name:var(--font-playfair)] text-2xl font-black leading-tight hover:underline underline-offset-4 decoration-2">
                                                        {item.title}
                                                    </h4>
                                                </Link>
                                                <div className="font-[family-name:var(--font-source-sans)] text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-2 flex items-center gap-3">
                                                    <span>{formatTimeAgo(item.publish_date)}</span>
                                                    <span>•</span>
                                                    <span className="text-accent">{deskTitle} Desk</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
