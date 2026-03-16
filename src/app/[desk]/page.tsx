export const runtime = 'edge';

import { NewsGrid } from "@/components/ui/grid";
import Link from 'next/link';
import { notFound } from "next/navigation";

const VALID_DESKS = ["politics", "crime", "business", "entertainment", "sports", "science", "education"];

// Category-specific mock data for a polished, robust placeholder experience
const deskDataMap: Record<string, any> = {
    politics: {
        title: "Politics",
        lead: {
            headline: "Senate Appropriations Committee Clashes Over Defense Budget Allocations",
            excerpt: "Hours of testimony revealed deep partisan divides on modernization priorities, with specific focus on maritime autonomous systems and strategic defensive infrastructure.",
            author: "Capitol Bureau",
            time: "2h ago"
        },
        secondary: [
            { tag: "Elections", headline: "New Polls Indicate Shifting Demographics in Key Swing Counties", excerpt: "A comprehensive voter registration analysis shows surprising migration patterns." },
            { tag: "Policy", headline: "Bipartisan Coalition Proposes Sweeping Privacy Legislation", excerpt: "The draft bill aims to unify state patchwork laws into a cohesive federal framework." },
            { tag: "Diplomacy", headline: "Secretary of State Concludes Summit with Trade Partners", excerpt: "Negotiations focused on securing vital supply chains for the technology sector." },
            { tag: "Analysis", headline: "What the Latest Executive Order Means for Local Municipalities", excerpt: "Breaking down the immediate budgetary impact on city-level infrastructure planning." }
        ]
    },
    crime: {
        title: "Crime & Justice",
        lead: {
            headline: "Major Cybercrime Ring Dismantled in Multi-Agency Operation Spanning 12 Countries",
            excerpt: "Law enforcement agencies across three continents coordinated to arrest 47 suspects tied to a sophisticated ransomware network responsible for hundreds of corporate breaches.",
            author: "Justice Desk",
            time: "4h ago"
        },
        secondary: [
            { tag: "Investigation", headline: "Audit Reveals $4.2B in Misallocated Infrastructure Funds", excerpt: "Official records indicate billions diverted from bridge repair into untracked municipal funds." },
            { tag: "Courts", headline: "Supreme Court to Hear Landmark Digital Rights Case This Term", excerpt: "The ruling could fundamentally alter how data brokers operate across borders." },
            { tag: "Local", headline: "City Police Department Announces New Community Liaison Initiative", excerpt: "The program aims to bridge the trust gap through designated neighborhood officers." },
            { tag: "Federal", headline: "DOJ Indicts Three in Interstate Counterfeit Operations", excerpt: "The year-long sting operation recovered millions in forged currency and documents." }
        ]
    },
    business: {
        title: "Business",
        lead: {
            headline: "Market Recovers Sharply Following Better-Than-Expected CPI Data Release",
            excerpt: "Core inflation met expectations, cooling fears of an aggressive rate hike in the upcoming FOMC meeting and sending tech shares to a four-week high.",
            author: "Financial Desk",
            time: "1h ago"
        },
        secondary: [
            { tag: "Markets", headline: "Federal Reserve Signals Cautious Approach to Interest Rate Adjustments", excerpt: "The central bank indicated it will maintain its current policy stance for the quarter." },
            { tag: "Tech", headline: "Industry Giant Announces $10B Investment in Domestic Chip Manufacturing", excerpt: "The new facility is expected to bring 5,000 high-paying jobs to the region." },
            { tag: "Labor", headline: "National Logistics Union Reaches Tentative Contract Agreement", excerpt: "The last-minute deal averts a strike that threatened to paralyze holiday shipping." },
            { tag: "Analysis", headline: "The Silent Rise of AI-Driven Boutique Hedge Funds", excerpt: "How small algorithmic trading desks are outperforming traditional Wall Street behemoths." }
        ]
    },
    entertainment: {
        title: "Entertainment",
        lead: {
            headline: "Independent Studio Sweeps Major Categories at International Film Festival",
            excerpt: "The psychological thriller captivated judges, securing Best Picture and Best Director in a historic upset against major Hollywood productions.",
            author: "Culture Desk",
            time: "6h ago"
        },
        secondary: [
            { tag: "Streaming", headline: "Global Streaming Platform Announces Major Strategy Pivot", excerpt: "The focus will shift from volume to prestige limited series and live events." },
            { tag: "Music", headline: "Legendary Rock Venue Reopens After Complete Heritage Restoration", excerpt: "The acoustic properties have been preserved while modernizing the infrastructure." },
            { tag: "Box Office", headline: "Summer Blockbuster Unexpectedly Underperforms Opening Weekend", excerpt: "Analysts point to franchise fatigue and strong competition from independent releases." },
            { tag: "Arts", headline: "Modern Art Museum Acquires Controversial Digital Collection", excerpt: "The purchase sparks a debate about the long-term archival value of digital media." }
        ]
    },
    sports: {
        title: "Sports",
        lead: {
            headline: "Underdog Franchise Secures Championship Following Dramatic Overtime Victory",
            excerpt: "In a series that defined the season, the team executed a flawless final play to break the deadlock and secure their first title in three decades.",
            author: "Athletics Desk",
            time: "3h ago"
        },
        secondary: [
            { tag: "League", headline: "Commissioner Announces Expansion Plans for Four New Cities", excerpt: "The highly anticipated move will bring professional franchises to emerging markets." },
            { tag: "Medical", headline: "Breakthrough in Recovery Protocols Could Extend Player Careers", excerpt: "New regenerative therapies are dramatically reducing downtime from ligament injuries." },
            { tag: "Draft", headline: "Analysts Divided Over Top Prospect's Transition to Professional League", excerpt: "Questions remain about how the collegiate star will adapt to the faster pace." },
            { tag: "Global", headline: "International Tournament Sets New Broadcast Viewership Records", excerpt: "The final match drew an estimated 1.5 billion viewers globally." }
        ]
    },
    science: {
        title: "Science",
        lead: {
            headline: "NASA's Artemis IV Mission Successfully Deploys Lunar Gateway Module",
            excerpt: "The first habitable module of the Lunar Gateway was deployed into orbit around the Moon, marking a critical milestone in humanity's return to deep space exploration.",
            author: "Space Desk",
            time: "5h ago"
        },
        secondary: [
            { tag: "Climate", headline: "Oceanographic Survey Maps Unprecedented Deep Sea Coral Habitats", excerpt: "The discovery challenges existing models of biodiversity in extreme environments." },
            { tag: "Physics", headline: "CERN Researchers Report Anomalous Reading in Latest Collision Data", excerpt: "The results, if verified, could indicate physics beyond the Standard Model." },
            { tag: "Medicine", headline: "Phase III Trials Confirm Efficacy of Novel Targeted Immunotherapy", excerpt: "The treatment shows significant promise in managing previously untreatable conditions." },
            { tag: "Materials", headline: "Engineers Develop Biodegradable Polymer Stronger Than Steel", excerpt: "The synthetic material could revolutionize packaging and manufacturing processes." }
        ]
    },
    education: {
        title: "Education",
        lead: {
            headline: "National Board Introduces Comprehensive Overhaul of STEM Curriculum Standards",
            excerpt: "The new guidelines focus on computational thinking and data literacy, shifting away from rote memorization toward project-based applied learning architectures.",
            author: "Education Desk",
            time: "8h ago"
        },
        secondary: [
            { tag: "Policy", headline: "Federal Grant Program Targets Rural Connectivity Gaps in Public Schools", excerpt: "The initiative aims to ensure all students have access to high-speed broadband." },
            { tag: "Higher Ed", headline: "University System Freezes Tuition for Fourth Consecutive Year", excerpt: "Administrators cite aggressive endowment restructuring and operational efficiencies." },
            { tag: "Research", headline: "Longitudinal Study Links Early Arts Access to Improved Graduation Rates", excerpt: "The data suggests comprehensive arts education is a critical factor in student retention." },
            { tag: "Tech", headline: "Districts Grapple with Integrating AI Tools Authentically in Classrooms", excerpt: "Educators are developing new frameworks to treat AI as a collaborator rather than a shortcut." }
        ]
    }
};

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

    if (!VALID_DESKS.includes(desk)) {
        notFound();
    }

    const data = deskDataMap[desk];
    const tabs = SUBSECTIONS[desk] || ["All"];

    const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    return (
        <div className="container max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12 min-h-screen">

            {/* Header Area */}
            <div className="flex flex-col gap-6 border-b border-border pb-0">
                <div className="flex justify-between items-end pb-4 border-b-4 border-foreground">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">{data.title}</h1>
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
                    <Link href={`/${desk}/${slugify(data.lead.headline)}`} className="aspect-[21/9] bg-muted border border-border flex items-center justify-center hover:opacity-90 transition-opacity">
                        <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">LEAD IMAGE: {data.title.toUpperCase()}</span>
                    </Link>
                    <div className="flex flex-col gap-3">
                        <Link href={`/${desk}/${slugify(data.lead.headline)}`}>
                            <h2 className="font-[family-name:var(--font-playfair)] text-4xl md:text-6xl font-black leading-[1.1] tracking-tight hover:text-accent transition-colors">
                                {data.lead.headline}
                            </h2>
                        </Link>
                        <p className="text-xl md:text-2xl text-muted-foreground font-[family-name:var(--font-playfair)] leading-relaxed mt-2">
                            {data.lead.excerpt}
                        </p>
                    </div>
                    <div className="font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-4 mt-2">
                        <span>By {data.lead.author}</span>
                        <span>•</span>
                        <span>{data.lead.time}</span>
                    </div>
                </div>

                {/* Supporting News Sidebar */}
                <div className="col-span-1 md:col-span-4 lg:col-span-4 flex flex-col gap-8 md:pl-8 md:border-l border-border mt-8 md:mt-0">
                    {data.secondary.map((story: any, i: number) => (
                        <div key={i} className="group cursor-pointer">
                            <span className="font-[family-name:var(--font-source-sans)] block text-[10px] font-bold text-accent uppercase tracking-wider mb-2">
                                {story.tag}
                            </span>
                            <Link href={`/${desk}/${slugify(story.headline)}`}>
                                <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-black mb-3 group-hover:underline underline-offset-4 decoration-2 leading-tight tracking-tight">
                                    {story.headline}
                                </h3>
                                <p className="font-[family-name:var(--font-source-sans)] text-sm md:text-base text-muted-foreground mb-4 leading-relaxed">
                                    {story.excerpt}
                                </p>
                            </Link>
                            {i < data.secondary.length - 1 && <hr className="mt-8 border-border" />}
                        </div>
                    ))}
                </div>
            </NewsGrid>

            {/* Subsections Content Rows */}
            {tabs.length > 1 && (
                <div className="flex flex-col gap-16 mt-20 pb-16">
                    {tabs.filter(t => t !== "All").map((subsection, idx) => (
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
                                {[1, 2, 3].map((item) => (
                                    <div key={item} className="flex flex-col gap-4 group cursor-pointer group">
                                        <div className="aspect-[4/3] bg-muted border border-border flex items-center justify-center overflow-hidden">
                                            <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">IMAGE: {subsection}</span>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <Link href={`/${desk}/${slugify(`Latest ongoing developments and detailed analysis surrounding ${subsection.toLowerCase()} operations`)}`}>
                                                <h4 className="font-[family-name:var(--font-playfair)] text-2xl font-black leading-tight hover:underline underline-offset-4 decoration-2">
                                                    Latest ongoing developments and detailed analysis surrounding {subsection.toLowerCase()} operations.
                                                </h4>
                                            </Link>
                                            <div className="font-[family-name:var(--font-source-sans)] text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-2 flex items-center gap-3">
                                                <span>{Math.floor(Math.random() * 12) + 1}h ago</span>
                                                <span>•</span>
                                                <span className="text-accent">{subsection} Desk</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
