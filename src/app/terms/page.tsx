import type { Metadata } from "next";
import Link from "next/link";

const DESCRIPTION =
    "Terms of use for The Daily Borg, including how our AI-written summaries should be treated and what the Borg Record does and does not claim.";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: DESCRIPTION,
    alternates: { canonical: "https://dailyborg.com/terms" },
    openGraph: { type: "article", url: "https://dailyborg.com/terms", title: "Terms of Service | The Daily Borg", description: DESCRIPTION, images: ["/og-default.png"] },
};

export default function TermsPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Terms of Service
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        Using this site
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-muted-foreground leading-relaxed">
                        By using The Daily Borg you accept the terms below. They are short on purpose.
                    </p>

                    <h2>1. What this site is</h2>
                    <p>
                        The Daily Borg is an autonomous newsroom published by TSYBORG. Articles are written
                        by an AI model from reporting that other news organisations have already published.
                        The <Link href="/borg-record">Borg Record</Link> is assembled from structured public
                        records: the congress-legislators dataset, OpenStates, Wikidata, PolitiFact&apos;s
                        published rulings, and the official House and Senate roll-call files. No language
                        model decides facts about real people.
                    </p>

                    <h2>2. How to treat what you read</h2>
                    <p>
                        Our articles are summaries, not original reporting, and automated summarisation can
                        get things wrong or drop context. Follow the source link before you rely on
                        anything here. Nothing on this site is legal, financial, or professional advice.
                    </p>

                    <h2>3. The Borg Record is a mirror, not a verdict</h2>
                    <p>
                        A fact-check rating shown on the Record is PolitiFact&apos;s rating, carried over as
                        published, not ours. A vote shown on the Record is what the official roll call
                        recorded. If you believe an underlying record is wrong, the fix belongs with the
                        body that published it, and we will correct our copy once theirs changes.
                    </p>

                    <h2>4. Reuse</h2>
                    <p>
                        You may quote and link to our pages freely with attribution. Automated collection
                        must stay within reasonable rate limits so the site keeps working for readers.
                        Content that we summarise from other outlets remains theirs, and their terms apply
                        to it.
                    </p>

                    <h2>5. Fair use of the site</h2>
                    <p>
                        Do not attempt to break, overload, or manipulate the site, its comment system, or
                        its data. Accounts and comments that do may be removed.
                    </p>

                    <h2>6. Changes</h2>
                    <p>
                        These terms may change as the site changes. The effective date below tells you
                        which version you are reading.
                    </p>

                    <div className="p-6 bg-muted border-l-4 border-foreground mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            Effective September 2026. Questions: pressroom@dailyborg.com
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
