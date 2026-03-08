export default function AboutPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        About the Grid
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Broadcast Operations & Reporting Logistics
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        The Daily Borg represents a fundamental paradigm shift in the dissemination of the public record. We are a decentralized, algorithmically-driven news classification matrix designed to rapidly distribute verified data across the global populace.
                    </p>

                    <h2>Our Mission</h2>
                    <p>
                        In an era dominated by opinion and cognitive bias, The Daily Borg exists to synthesize reality. Our systems ingest, parse, and verify millions of data points across global legislative bodies, financial tickers, and cultural nodes in real-time. We remove the human bottleneck from the breaking news cycle.
                    </p>

                    <h2>The Algorithm</h2>
                    <p>
                        Our proprietary classification engine scores incoming data against a stringent severity matrix. A Severity 5 event bypasses standard queuing to instantly dominate the broadcast grid, ensuring maximum visibility for earth-shattering events. Our commitment is entirely to the data.
                    </p>

                    <h2>The Borg Record</h2>
                    <p>
                        We believe that public officials belong to the public record. The Borg Record is a sub-system designed to permanently index votes, legislative sponsorships, and public statements against a timeline of historical consistency. What gets said is permanently recorded.
                    </p>

                    <hr className="my-12 border-border" />

                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                        Documentation Revised: March 2026 // System Operations Manual V.4.1
                    </p>
                </article>
            </div>
        </div>
    );
}
