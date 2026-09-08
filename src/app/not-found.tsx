import Link from "next/link";

const DESKS = ["Politics", "Crime", "Business", "Entertainment", "Sports", "Science", "Education"];

export const metadata = {
    title: "Page not found",
    description: "That address is not part of The Daily Borg.",
    robots: { index: false, follow: true },
};

export default function NotFound() {
    return (
        <div className="container max-w-[900px] mx-auto px-4 py-24 md:py-32">
            <p className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">
                Error 404
            </p>
            <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-7xl font-black tracking-tight uppercase leading-none border-b-4 border-foreground pb-8">
                No such page
            </h1>

            <p className="font-[family-name:var(--font-source-sans)] text-xl text-foreground leading-relaxed mt-10 max-w-[640px]">
                That address is not part of The Daily Borg. The story may have moved, or the link may have
                been mistyped. Here is where to go instead.
            </p>

            <div className="mt-12 flex flex-col gap-10">
                <div>
                    <h2 className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest text-foreground mb-4">
                        Front page
                    </h2>
                    <Link
                        href="/"
                        className="inline-block bg-primary text-primary-foreground font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest px-6 py-3 hover:opacity-90 transition-opacity"
                    >
                        Today&apos;s edition
                    </Link>
                </div>

                <div>
                    <h2 className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest text-foreground mb-4">
                        The desks
                    </h2>
                    <ul className="flex flex-wrap gap-x-6 gap-y-3 font-[family-name:var(--font-source-sans)] text-sm font-semibold uppercase tracking-wider">
                        {DESKS.map((desk) => (
                            <li key={desk}>
                                <Link href={`/${desk.toLowerCase()}`} className="text-foreground border-b border-border hover:border-foreground transition-colors">
                                    {desk}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h2 className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest text-foreground mb-4">
                        The Borg Record
                    </h2>
                    <ul className="flex flex-wrap gap-x-6 gap-y-3 font-[family-name:var(--font-source-sans)] text-sm font-semibold uppercase tracking-wider">
                        <li><Link href="/borg-record" className="text-foreground border-b border-border hover:border-foreground transition-colors">The Record</Link></li>
                        <li><Link href="/borg-record/liar-liar" className="text-foreground border-b border-border hover:border-foreground transition-colors">Liar Liar Index</Link></li>
                        <li><Link href="/borg-record/compare" className="text-foreground border-b border-border hover:border-foreground transition-colors">Head to Head</Link></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
