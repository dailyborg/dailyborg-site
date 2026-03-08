import Link from 'next/link';

export default async function ArticlePage({ params }: { params: Promise<{ desk: string, slug: string }> }) {
    // In a real app, we would fetch the article data from the Cloudflare database using params.slug
    // For now, we simulate the fetched data
    const resolvedParams = await params;

    const formattedDesk = resolvedParams.desk.charAt(0).toUpperCase() + resolvedParams.desk.slice(1);

    // Convert slug (e.g., 'national-board-introduces-comprehensive-overhaul') into a readable title
    const formattedTitle = resolvedParams.slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const sidebarArticles = [
        {
            category: "POLICY",
            title: "Federal Grant Program Targets Rural Connectivity Gaps in Public Schools",
            excerpt: "The initiative aims to ensure all students have access to high-speed broadband."
        },
        {
            category: "HIGHER ED",
            title: "University System Freezes Tuition for Fourth Consecutive Year",
            excerpt: "Administrators cite aggressive endowment restructuring and operational efficiencies."
        },
        {
            category: "RESEARCH",
            title: "Longitudinal Study Links Early Arts Access to Improved Graduation Rates",
            excerpt: "The data suggests comprehensive arts education is a critical factor in student retention."
        },
        {
            category: "TECH",
            title: "Districts Grapple with Integrating AI Tools Authentically in Classrooms",
            excerpt: "Educators are developing new frameworks to treat AI as a collaborator rather than a shortcut."
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background relative">
            <main className="flex-1 w-full mx-auto px-4 md:px-6 py-8 md:py-12 max-w-[1200px]">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

                    {/* Main Article Content (Left Column) */}
                    <article className="lg:col-span-8 flex flex-col gap-8">

                        {/* Lead Image */}
                        <figure className="w-full">
                            <div className="bg-[#EFEBE6] dark:bg-muted aspect-[16/9] w-full relative flex items-center justify-center font-[family-name:var(--font-source-sans)] uppercase tracking-widest text-[#9CA3AF] text-[10px] md:text-xs font-bold">
                                LEAD IMAGE: {formattedDesk.toUpperCase()}
                            </div>
                        </figure>

                        {/* Article Header Details */}
                        <header className="flex flex-col gap-6 mt-2">
                            <h1 className="font-[family-name:var(--font-playfair)] font-black text-5xl md:text-6xl text-foreground hover:text-[#DFA823] transition-colors tracking-tight leading-[1.05]">
                                {formattedTitle}
                            </h1>

                            <p className="font-[family-name:var(--font-playfair)] font-bold text-xl md:text-2xl text-foreground/90 leading-snug">
                                The new guidelines focus on computational thinking and data literacy, shifting away from rote memorization toward project-based applied learning architectures.
                            </p>

                            <div className="flex items-center gap-3 font-[family-name:var(--font-source-sans)] text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#64748B] dark:text-muted-foreground pt-4 border-t border-border mt-2">
                                <span>BY {formattedDesk.toUpperCase()} DESK</span>
                                <span>•</span>
                                <span>8H AGO</span>
                            </div>
                        </header>

                        {/* Article Text */}
                        <div className="flex flex-col gap-6 text-lg md:text-xl font-[family-name:var(--font-source-sans)] text-foreground/90 leading-relaxed mt-4">
                            <p className="first-letter:float-left first-letter:text-7xl first-letter:pr-3 first-letter:font-[family-name:var(--font-playfair)] first-letter:font-black first-letter:text-foreground hover:first-letter:text-[#DFA823] transition-colors first-letter:leading-[0.8]">
                                Washington — This is a simulated article body demonstrating the robust dynamic routing capabilities of the new platform layout. As reports continue to surge through the official channels, analysts have noted a stark contrast between expected timelines and actual deployment speeds.
                            </p>

                            <p>
                                In a closely watched development today, sources familiar with the matter confirmed that preliminary structural overhauls have already begun taking root within the established metadata frameworks, catching many off-guard.
                            </p>

                            <div className="my-8 pl-6 border-l-4 border-[#DFA823]">
                                <h3 className="font-[family-name:var(--font-playfair)] font-black text-2xl mb-2 text-foreground">Substantial Strategic Shifts</h3>
                                <p className="text-lg text-foreground/80 font-[family-name:var(--font-source-sans)]">
                                    The strategic direction has officially pivoted toward automation and dynamic ingestion templates, a move experts say will fundamentally alter how syndicate information is processed and displayed.
                                </p>
                            </div>

                            <p>
                                Moving forward, the architectural scaffolding will rely heavily on an algorithmic approach to content presentation. By decoupling the presentation layer from the raw data feeds, The Daily Borg ensures an infinite variety of "front pages" depending on the velocity, severity, and volume of local inputs.
                            </p>

                            <p>
                                Further implications regarding market sector recovery, regulatory oversight, and infrastructural funding re-allocations are expected to unfold over the coming days. The coordination between these various subsystems remains a top priority for syndicate engineers.
                            </p>
                        </div>

                        {/* System Ingestion Record (Sources Block) */}
                        <div className="mt-16 pt-8 border-t-2 border-border mb-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-2 h-2 rounded-full bg-[#DFA823] animate-pulse"></div>
                                <h3 className="font-[family-name:var(--font-source-sans)] font-black text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    System Ingestion Record
                                </h3>
                            </div>

                            <div className="flex flex-col gap-4">
                                {/* Source 1 */}
                                <div className="bg-muted/30 p-5 border border-border/50 font-[family-name:var(--font-source-sans)]">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                        <div className="font-bold text-foreground text-sm uppercase tracking-wider">Dept. of Education Press Release #442-A</div>
                                        <div className="text-[10px] uppercase font-bold text-[#DFA823] tracking-widest border border-[#DFA823]/30 bg-[#DFA823]/5 px-3 py-1 w-max">
                                            Confidence: 98.4%
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground text-[11px] font-mono mb-4 flex flex-col gap-1">
                                        <span>ORIGIN: ed.gov/news/press-releases/stem-overhaul</span>
                                        <span>INGESTED: 2026-03-07T08:14:22Z</span>
                                    </div>
                                    <div className="text-xs text-foreground/80 leading-relaxed">
                                        <span className="font-bold text-foreground">EXTRACTED VECTORS:</span> "Computational thinking", "data literacy", "project-based applied learning architectures"
                                    </div>
                                </div>

                                {/* Source 2 */}
                                <div className="bg-muted/30 p-5 border border-border/50 font-[family-name:var(--font-source-sans)]">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                        <div className="font-bold text-foreground text-sm uppercase tracking-wider">Reuters Wire / National Policy Desk</div>
                                        <div className="text-[10px] uppercase font-bold text-[#DFA823] tracking-widest border border-[#DFA823]/30 bg-[#DFA823]/5 px-3 py-1 w-max">
                                            Confidence: 96.1%
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground text-[11px] font-mono mb-4 flex flex-col gap-1">
                                        <span>ORIGIN: reuters.com/world/us/education-board-stem-guidelines</span>
                                        <span>INGESTED: 2026-03-07T09:02:11Z</span>
                                    </div>
                                    <div className="text-xs text-foreground/80 leading-relaxed">
                                        <span className="font-bold text-foreground">EXTRACTED VECTORS:</span> "rote memorization shift", "national board guidelines override"
                                    </div>
                                </div>
                            </div>
                        </div>

                    </article>

                    {/* Sidebar Content (Right Column) */}
                    <aside className="lg:col-span-4 flex flex-col">
                        <div className="flex flex-col gap-0 border-t border-border lg:border-t-0">
                            {sidebarArticles.map((article, idx) => (
                                <div key={idx} className="flex flex-col gap-3 py-6 border-b border-border border-dashed lg:border-solid lg:border-b-2 lg:first:pt-0 group cursor-pointer">
                                    <div className="font-[family-name:var(--font-source-sans)] text-[10px] font-black uppercase tracking-widest text-[#DFA823]">
                                        {article.category}
                                    </div>
                                    <h4 className="font-[family-name:var(--font-playfair)] text-xl font-bold leading-tight text-[#0f172a] dark:text-slate-100 group-hover:underline underline-offset-4 decoration-2">
                                        {article.title}
                                    </h4>
                                    <p className="font-[family-name:var(--font-source-sans)] text-sm text-[#64748B] dark:text-slate-400">
                                        {article.excerpt}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </aside>

                </div>
            </main>
        </div>
    );
}
