import type { Metadata } from "next";

const DESCRIPTION =
    "How to reach The Daily Borg: corrections, tips, press enquiries and site problems all go to pressroom@dailyborg.com.";

export const metadata: Metadata = {
    title: "Contact",
    description: DESCRIPTION,
    alternates: { canonical: "https://dailyborg.com/contact" },
    openGraph: { type: "article", url: "https://dailyborg.com/contact", title: "Contact | The Daily Borg", description: DESCRIPTION, images: ["/og-default.png"] },
};

export default function ContactPage() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-16 md:py-24">
            <div className="space-y-12">
                <header className="space-y-6 border-b-4 border-foreground pb-8">
                    <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none">
                        Contact
                    </h1>
                    <p className="font-[family-name:var(--font-source-sans)] text-xl font-semibold uppercase tracking-widest text-muted-foreground">
                        One address, read by a person
                    </p>
                </header>

                <article className="prose prose-lg dark:prose-invert font-[family-name:var(--font-source-sans)] text-foreground prose-headings:font-[family-name:var(--font-playfair)] prose-headings:font-black pb-16">
                    <p className="lead text-2xl font-[family-name:var(--font-playfair)] text-muted-foreground leading-relaxed">
                        Everything comes to the same inbox: <strong>pressroom@dailyborg.com</strong>. It is
                        read by a person, not by the software that writes the site.
                    </p>

                    <h2>Corrections</h2>
                    <p>
                        This is the message we care about most. If a story misreads the reporting it
                        summarised, or a Borg Record entry is wrong, send the page address and the link to
                        the source that shows it. Corrections are made on the page and noted there.
                    </p>

                    <h2>Press and reuse</h2>
                    <p>
                        For questions about how the site is built, permission to reuse a page, or anything
                        about the data behind the Borg Record, use the same address and say what you need.
                    </p>

                    <h2>Something is broken</h2>
                    <p>
                        If a page will not load, a subscription confirmation never arrived, or you want your
                        subscriber record deleted, write in and describe what happened. Include the page
                        address if there is one.
                    </p>

                    <div className="p-6 bg-muted border-l-4 border-accent mt-12">
                        <p className="m-0 text-sm font-bold uppercase tracking-widest">
                            Email only. There is no postal address and no phone line.
                        </p>
                    </div>
                </article>
            </div>
        </div>
    );
}
