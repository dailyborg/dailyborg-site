import type { Metadata } from "next";
import Link from "next/link";

const DESCRIPTION =
    "How The Daily Borg works: an autonomous newsroom that writes from published reporting, and a public record of officials built only from structured public sources.";

export const metadata: Metadata = {
    title: "About",
    description: DESCRIPTION,
    alternates: { canonical: "https://dailyborg.com/about" },
    openGraph: { type: "article", url: "https://dailyborg.com/about", title: "About | The Daily Borg", description: DESCRIPTION, images: ["/og-default.png"] },
};

export default function AboutPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        About The Daily Borg
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        How this newspaper is actually made
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        The Daily Borg is an autonomous newsroom. Software gathers published reporting,
                        an AI model writes the day&apos;s summaries from it, and a separate system keeps a
                        public record of United States officials built only from official data. There is
                        no human reporting staff, and we do not pretend otherwise.
                    </p>

                    <h2>Where the stories come from</h2>
                    <p>
                        Every story on this site starts with reporting that a major news organisation has
                        already published. We read their public feeds, group the coverage by topic, and an
                        AI model writes a summary of what has been reported. That summary is the article
                        you read. We are a second-hand account of somebody else&apos;s first-hand work, and the
                        original outlet is credited so you can go and read it.
                    </p>
                    <p>
                        This has limits, and you should know them. If the underlying report is wrong, our
                        summary will be wrong in the same way. If a story is developing, our version is a
                        snapshot of what was published at that moment. Treat what you read here as a
                        pointer to the source, not a replacement for it.
                    </p>

                    <h2>The Borg Record</h2>
                    <p>
                        The <Link href="/borg-record">Borg Record</Link> is the part of this site that
                        deals with named people, so it works completely differently. No language model
                        decides anything about a real person here. Every entry comes from a structured
                        public source:
                    </p>
                    <ul>
                        <li>Rosters and biographical detail from the congress-legislators dataset, OpenStates and Wikidata.</li>
                        <li>Fact-check outcomes from PolitiFact&apos;s published rulings, carried over as they were published.</li>
                        <li>Voting histories from the official House and Senate roll-call XML.</li>
                    </ul>
                    <p>
                        Every claim in the Record links back to the record it came from. Where the data is
                        thin, the page says so instead of guessing, and where an official has too few
                        published rulings to say anything meaningful, we show no score at all.
                    </p>

                    <h2>What we do not do</h2>
                    <p>
                        We do not send reporters anywhere. We do not break news. We do not let a model
                        decide whether a person lied, only whether a published fact-check said so. We do
                        not claim to be free of bias: the model writes from the reporting it is given, and
                        that reporting carries whatever bias its authors carried.
                    </p>

                    <h2>Corrections and contact</h2>
                    <p>
                        The Daily Borg is published by TSYBORG. If a story misreads its source, or a Record
                        entry is wrong, tell us and include the link. Corrections are made on the page.
                    </p>
                    <ul>
                        <li><strong>Email:</strong> pressroom@dailyborg.com</li>
                    </ul>

                    <hr className="my-12 border-border" />

                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">
                        Last revised: September 2026
                    </p>
                </article>
            </div>
        </div>
    );
}
