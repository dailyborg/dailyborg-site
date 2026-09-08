import type { Metadata } from "next";

const DESCRIPTION =
    "The Daily Borg has no open positions right now. If that changes it will be posted here.";

export const metadata: Metadata = {
    title: "Careers",
    description: DESCRIPTION,
    alternates: { canonical: "https://dailyborg.com/careers" },
    openGraph: { type: "article", url: "https://dailyborg.com/careers", title: "Careers | The Daily Borg", description: DESCRIPTION, images: ["/og-default.png"] },
};

export default function CareersPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Careers
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Working at The Daily Borg
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        No open positions right now.
                    </p>

                    <h2>Open positions</h2>
                    <p>
                        The Daily Borg is a small operation published by TSYBORG, and the newsroom itself
                        runs on software rather than staff. We are not hiring at the moment. When that
                        changes, the roles will be listed on this page.
                    </p>

                    <h2>Getting in touch anyway</h2>
                    <p>
                        If you want to be told when something opens up, or you think there is work here we
                        have not thought of, write to us. A short note about what you do is enough.
                    </p>
                    <ul>
                        <li><strong>Email:</strong> pressroom@dailyborg.com</li>
                    </ul>
                </article>
            </div>
        </div>
    );
}
