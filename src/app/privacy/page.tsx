export default function PrivacyPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Privacy Policy
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Data Ingestion & Telemetry Standards
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-muted-foreground leading-relaxed">
                        The Daily Borg is fundamentally engineered for transparency in all operations. This protocol governs the minimal data required to maintain Broadcast Operations.
                    </p>

                    <h2>1. Telemetry and System Logs</h2>
                    <p>
                        Our edge network automatically logs non-identifying telemetry data, including network latency, rendering times, and algorithmic layout state preferences. This data is utilized strictly for system diagnostics and optimizing load times across global nodes.
                    </p>

                    <h2>2. Subscriber Manifests</h2>
                    <p>
                        If you execute a subscription protocol, your provided contact vector (e.g., Email Address or Signal Number) is cryptographically hashed and stored in our D1 database. We do not sell, rent, or distribute subscriber manifests to third-party entities, brokers, or political action committees.
                    </p>

                    <h2>3. Cookies and Persistent States</h2>
                    <p>
                        The Broadcast Operations & Reporting Grid utilizes minimal persistent storage (e.g., local storage) solely to preserve your visual theme preference (Light/Dark/System) and your last known Time of Day Edition state.
                    </p>

                    <h2>4. Public Record Ingestion</h2>
                    <p>
                        Please note that the <strong>Borg Record</strong> sub-system algorithmically ingests and indexes public statements, legislative votes, and official disclosures made by public figures. If you are a sworn representative of a legislative body, your official actions are subject to permanent ingestion and classification. We do not remove public records.
                    </p>

                    <div className="p-6 bg-muted border-l-4 border-foreground mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            Effective Date: Version 2026.04.1
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
