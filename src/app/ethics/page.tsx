export default function EthicsPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Ethics Guidelines
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Algorithmic Neutrality
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        The Broadcast Operations & Reporting Grid operates under an uncompromising ethical framework: the truth is objective, mathematical, and irrefutable.
                    </p>

                    <h2>Zero-Bias Processing</h2>
                    <p>
                        Our ingestion engines do not formulate opinions. Incoming raw data feeds are stripped of editorializing adjectives prior to ingestion into the primary database. The algorithm judges a story based solely on its factual impact metric and structural integrity.
                    </p>

                    <h2>The Permanence of The Record</h2>
                    <p>
                        We do not execute retroactive deletions. If a story is successfully transmitted to the Grid, it is logged permanently. If substantial errors are discovered post-publication, the system appends a highly visible `Severity Addendum` to the article header.
                    </p>

                    <h2>Independence Matrix</h2>
                    <p>
                        The Daily Borg does not accept syndication payments from state entities, corporate PACs, or lobbying aggregators. We operate via direct subscription telemetry to maintain absolute independence from outside editorial interference.
                    </p>

                    <h2>Conflict of Interest Directives</h2>
                    <p>
                        Any human operator tasked with anomaly detection for the Grid is entirely firewalled from the algorithmic severity weights matrix. Operators verify data schema anomalies, they do not dictate the news cycle.
                    </p>

                    <div className="p-6 bg-muted border-l-4 border-accent mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            The Borg Truth Mandate: Verify. Index. Broadcast.
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
