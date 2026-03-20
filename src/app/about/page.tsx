export default function AboutPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        About DailyBorg
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Broadcast Operations & Journalistic Standards
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        The Daily Borg represents a fundamental paradigm shift in the dissemination of the public record. We are a decentralized, algorithmically-driven news organization designed to rapidly distribute verified data and original political reporting.
                    </p>

                    <h2>Our Mission</h2>
                    <p>
                        In an era dominated by opinion and cognitive bias, The Daily Borg exists to synthesize reality. Our editorial systems ingest, parse, and verify millions of data points across global legislative bodies, financial tickers, and cultural nodes in real-time. 
                    </p>

                    <h2>Original Reporting & Standards</h2>
                    <p>
                        We are committed to original, timely reporting and uncompromised transparency. Our autonomous engines and team of analysts produce unique insights by indexing votes, legislative sponsorships, and public statements against a timeline of historical consistency. What gets said is permanently recorded in the Borg Record.
                    </p>

                    <h2>Editorial Transparency & Contact</h2>
                    <p>
                        DailyBorg is headquartered in Washington, D.C. We believe our readers have a right to know who is delivering their news and how to contact them.
                    </p>
                    <ul>
                        <li><strong>Email:</strong> editor@dailyborg.com</li>
                        <li><strong>Phone:</strong> (202) 555-0198</li>
                        <li><strong>Address:</strong> 100 Capitol St, Suite 400, Washington D.C., 20001, USA</li>
                    </ul>

                    <h2>Our Editorial Team</h2>
                    <p>
                        Our journalism is powered by an autonomous editorial engine overseen and directed by our team of political analysts, investigative reporters, and policy correspondents. Every article we publish features a clear, linked byline connecting you directly to the author''s professional biography and credentials.
                    </p>

                    <hr className="my-12 border-border" />

                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                        Documentation Revised: March 2026 // Editorial Standards Manual V.4.1
                    </p>
                </article>
            </div>
        </div>
    );
}
