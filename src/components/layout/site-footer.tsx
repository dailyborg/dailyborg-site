import Link from "next/link";
import { Activity } from "lucide-react";

export function SiteFooter() {
    return (
        <footer className="w-full border-t border-border bg-background text-foreground mt-auto relative z-10">
            <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-16 md:py-24">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">

                    {/* Brand & Mission (Left Col) */}
                    <div className="md:col-span-5 flex flex-col gap-6">
                        <div>
                            <span className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl font-black tracking-tight leading-none uppercase">The Daily Borg</span>
                            <div className="font-[family-name:var(--font-source-sans)] text-[10px] sm:text-xs text-muted-foreground uppercase tracking-[0.25em] md:tracking-[0.3em] mt-2">
                                Broadcast Operations & Reporting Grid
                            </div>
                        </div>
                        <p className="font-[family-name:var(--font-source-sans)] text-sm md:text-base text-muted-foreground leading-relaxed max-w-sm">
                            The public record, documented without bias, interference, or delay. Algorithmic news distribution serving the global populace 24 hours a day.
                        </p>
                        <div className="flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-widest text-accent">
                            <Activity className="w-3.5 h-3.5 animate-sparkline" />
                            <span>System Active</span>
                        </div>
                    </div>

                    {/* Navigation Columns */}
                    <div className="md:col-span-2 md:col-start-7 flex flex-col gap-5">
                        <h4 className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest text-foreground">Desks</h4>
                        <ul className="flex flex-col gap-3 font-[family-name:var(--font-source-sans)] text-sm font-semibold tracking-wide text-muted-foreground">
                            {["Politics", "Crime", "Business", "Entertainment", "Sports", "Science", "Education"].map((link) => (
                                <li key={link}><Link href={`/${link.toLowerCase()}`} className="hover:text-foreground transition-colors">{link}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-5">
                        <h4 className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest text-foreground">Records</h4>
                        <ul className="flex flex-col gap-3 font-[family-name:var(--font-source-sans)] text-sm font-semibold tracking-wide text-muted-foreground">
                            <li><Link href="/borg-record" className="hover:text-foreground transition-colors">Borg Record</Link></li>
                            <li><Link href="/borg-record?tab=voting" className="hover:text-foreground transition-colors">Voting Records</Link></li>
                            <li><Link href="/borg-record?tab=statements" className="hover:text-foreground transition-colors">Public Statements</Link></li>
                            <li><Link href="/borg-record?tab=promises" className="hover:text-foreground transition-colors">Promise Tracker</Link></li>
                        </ul>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-5">
                        <h4 className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest text-foreground">Company</h4>
                        <ul className="flex flex-col gap-3 font-[family-name:var(--font-source-sans)] text-sm font-semibold tracking-wide text-muted-foreground">
                            <li><Link href="/about" className="hover:text-foreground transition-colors">About the Grid</Link></li>
                            <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact Protocol</Link></li>
                            <li><Link href="/subscribe" className="hover:text-foreground transition-colors">Subscribe</Link></li>
                            <li><Link href="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
                        </ul>
                    </div>

                </div>

                {/* Bottom Bar */}
                <div className="mt-20 pt-10 border-t border-border flex flex-col items-center justify-center gap-8 text-[11px] md:text-sm text-slate-500 font-[family-name:var(--font-source-sans)] uppercase tracking-[0.15em] font-semibold dark:text-slate-400">
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16">
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
                        <Link href="/ethics" className="hover:text-foreground transition-colors">Ethics Guidelines</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
