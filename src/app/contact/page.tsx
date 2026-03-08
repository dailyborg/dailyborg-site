export default function ContactPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Contact Protocol
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Secure Transmission Lines
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-muted-foreground leading-relaxed">
                        The Daily Borg operates a distributed network of editorial oversight and data ingestion nodes. To interact with our system or provide verifiable disclosures, select the appropriate protocol below.
                    </p>

                    <h2>Secure Tip Line (Encrypted)</h2>
                    <p>
                        For whistleblowers, primary sources, and verified disclosures, we operate an encrypted, zero-logging intake node. Transmissions submitted here will trigger immediate algorithmic review and prioritization.
                    </p>
                    <ul>
                        <li><strong>Signal:</strong> +1 (555) 019-BORG</li>
                        <li><strong>Secure Mail:</strong> intake@thedailyborg.com</li>
                    </ul>

                    <h2>Press & Media Inquiries</h2>
                    <p>
                        For syndication requests, system audits, or official commentary from our operations lead, utilize the standard press channel.
                    </p>
                    <ul>
                        <li><strong>Email:</strong> operations@thedailyborg.com</li>
                    </ul>

                    <h2>System Support</h2>
                    <p>
                        If you are experiencing anomalies rendering the Broadcast Grid or accessing your subscriber metrics, please contact our diagnostic team.
                    </p>
                    <ul>
                        <li><strong>Email:</strong> support@thedailyborg.com</li>
                    </ul>

                    <div className="p-6 bg-muted border-l-4 border-accent mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            Note: Do not dispatch physical mail to our server collocation facilities. All intake must be digital.
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
