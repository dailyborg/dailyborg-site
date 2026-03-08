export default function CareersPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Join The Grid
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Careers at The Daily Borg
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        We are seeking logic-driven operators who wish to build the next generation of algorithmic journalism infrastructure.
                    </p>

                    <h2>Open Requisitions</h2>

                    <div className="not-prose mt-8 flex flex-col gap-6">
                        {/* Job Listing 1 */}
                        <div className="border border-border p-6 hover:border-foreground transition-colors cursor-pointer group">
                            <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-black uppercase mb-2 group-hover:underline underline-offset-4">Systems Architect (Data Ingestion)</h3>
                            <div className="text-xs font-bold font-[family-name:var(--font-source-sans)] uppercase tracking-widest text-muted-foreground mb-4">Remote / Edge Computing</div>
                            <p className="font-[family-name:var(--font-source-sans)] text-sm text-foreground mb-0">负责 optimizing our global Cloudflare Worker pipeline. You will synthesize raw RSS and API feeds into pristine, Severity-scored JSON payloads at the edge.</p>
                        </div>

                        {/* Job Listing 2 */}
                        <div className="border border-border p-6 hover:border-foreground transition-colors cursor-pointer group">
                            <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-black uppercase mb-2 group-hover:underline underline-offset-4">Editorial Operations Manager</h3>
                            <div className="text-xs font-bold font-[family-name:var(--font-source-sans)] uppercase tracking-widest text-muted-foreground mb-4">New York / Hybrid</div>
                            <p className="font-[family-name:var(--font-source-sans)] text-sm text-foreground mb-0">Manage the exception queue. When the AI Engine flags a story for secondary review, you make the definitive call on publication and UI layout priority.</p>
                        </div>

                        {/* Job Listing 3 */}
                        <div className="border border-border p-6 hover:border-foreground transition-colors cursor-pointer group opacity-60">
                            <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-black uppercase mb-2">Frontend Engineer (React/Next)</h3>
                            <div className="text-xs font-bold font-[family-name:var(--font-source-sans)] uppercase tracking-widest text-muted-foreground mb-4">Position Filled</div>
                            <p className="font-[family-name:var(--font-source-sans)] text-sm text-foreground mb-0">Maintain the prestige aesthetic of the Broadcast Operations & Reporting Grid.</p>
                        </div>
                    </div>

                    <h2 className="mt-16">The Borg Ethos</h2>
                    <p>
                        Our team operates with the same ruthless efficiency as our news algorithms. We value direct communication, objective analysis, and a relentless commitment to the truth over narrative.
                    </p>
                </article>
            </div>
        </div>
    );
}
