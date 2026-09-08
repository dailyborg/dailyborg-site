import type { Metadata } from "next";
import Link from "next/link";

const DESCRIPTION =
    "The rules The Daily Borg holds itself to: sources are credited, no model decides facts about real people, corrections stay visible on the page.";

export const metadata: Metadata = {
    title: "Ethics Guidelines",
    description: DESCRIPTION,
    alternates: { canonical: "https://dailyborg.com/ethics" },
    openGraph: { type: "article", url: "https://dailyborg.com/ethics", title: "Ethics Guidelines | The Daily Borg", description: DESCRIPTION, images: ["/og-default.png"] },
};

export default function EthicsPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Ethics Guidelines
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        The rules we hold ourselves to
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-accent font-semibold leading-relaxed">
                        This site is written by software. That does not make it neutral, and we are not
                        going to claim it does. What it does mean is that the rules can be written down
                        plainly, and you can hold us to them.
                    </p>

                    <h2>1. Every story points at its source</h2>
                    <p>
                        Our articles are AI-written summaries of reporting that somebody else published
                        first. The outlet that did the work is credited. If you want the primary account,
                        follow the link. We are not the newspaper of record for anything; we are an index
                        into other people&apos;s reporting.
                    </p>

                    <h2>2. No model decides a fact about a person</h2>
                    <p>
                        In the <Link href="/borg-record">Borg Record</Link>, nothing is generated. Rosters
                        come from the congress-legislators dataset, OpenStates and Wikidata. Fact-check
                        outcomes come from PolitiFact&apos;s published rulings, kept exactly as PolitiFact
                        rated them. Votes come from the official House and Senate roll-call files. If a
                        claim about a named person cannot be traced to one of those, it does not go on the
                        site.
                    </p>

                    <h2>3. We say when we do not know</h2>
                    <p>
                        Thin data is shown as thin data. An official with only a handful of published
                        rulings gets no trust score, because a handful of rulings does not support one.
                        Empty is better than invented.
                    </p>

                    <h2>4. Corrections stay visible</h2>
                    <p>
                        When a story misreads its source, we fix the story and note the fix on the page.
                        We do not quietly rewrite history, and we do not delete a story to make an error
                        disappear.
                    </p>

                    <h2>5. Independence</h2>
                    <p>
                        The Daily Borg does not take payment from campaigns, political action committees,
                        or lobbying groups in exchange for coverage or placement. Subscriptions and
                        advertising are kept separate from what gets published.
                    </p>

                    <h2>6. Our known limits</h2>
                    <p>
                        The stories inherit the framing of the outlets we summarise. The Record inherits
                        whatever PolitiFact chose to fact-check, which is not a random sample of what
                        officials say. Automated summarisation can drop context. None of that is fixed by
                        calling the process objective, so we would rather list it here.
                    </p>

                    <div className="p-6 bg-muted border-l-4 border-accent mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            Found something wrong? pressroom@dailyborg.com, with the link.
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
