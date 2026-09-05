export const runtime = "edge";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRightLeft, ShieldCheck, Flame, Eye } from "lucide-react";
import { PoliticianService, MIN_RULINGS_FOR_TRUST } from "@/lib/services/politician-service";

type SearchParams = { [key: string]: string | string[] | undefined };

const RATING_LABEL: Record<string, string> = {
    true: "True", mostly_true: "Mostly True", half_true: "Half True", mostly_false: "Mostly False", false: "False", pants_on_fire: "Pants on Fire",
};

function metricColor(score: number | null): string {
    if (score === null) return "bg-slate-600";
    if (score < 50) return "bg-red-600";
    if (score < 70) return "bg-[#f2b90d]";
    return "bg-emerald-500";
}

function partyColor(party: string): string {
    return party === "Democrat" ? "text-blue-400" : party === "Republican" ? "text-red-400" : "text-[#f2b90d]";
}

/**
 * Head-to-head comparison built only from stored data. When either official is missing, the page
 * shows a picker of the most viewed federal officials instead of made-up defaults.
 */
export default async function CompareOfficialsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const sp = await searchParams;
    const p1Slug = typeof sp.p1 === "string" ? sp.p1 : "";
    const p2Slug = typeof sp.p2 === "string" ? sp.p2 : "";

    const [p1Profile, p2Profile] = await Promise.all([
        p1Slug ? PoliticianService.getProfile(p1Slug) : Promise.resolve(null),
        p2Slug ? PoliticianService.getProfile(p2Slug) : Promise.resolve(null),
    ]);

    if (!p1Profile || !p2Profile) {
        const featured = await PoliticianService.featured(24);
        const chosen = p1Profile?.politician || p2Profile?.politician || null;
        return (
            <div className="bg-[#12110a] text-slate-100 min-h-screen font-sans antialiased w-full pb-16">
                <div className="container mx-auto max-w-5xl px-4 md:px-8 py-12 md:py-16">
                    <h2 className="font-serif text-4xl md:text-5xl font-black mb-3 text-center tracking-tighter uppercase text-white">The Head-to-Head</h2>
                    <p className="text-center text-slate-400 mb-10 max-w-xl mx-auto">
                        {chosen ? `Pick an opponent for ${chosen.name}.` : "Pick two officials to compare their published records side by side."}
                    </p>
                    {featured.length === 0 ? (
                        <p className="text-center text-slate-500">The roster is still being built. Check back shortly.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {featured.filter(f => f.slug !== chosen?.slug).map(f => {
                                const href = chosen ? `/borg-record/compare?p1=${encodeURIComponent(chosen.slug)}&p2=${encodeURIComponent(f.slug)}` : `/borg-record/compare?p1=${encodeURIComponent(f.slug)}`;
                                return (
                                    <Link key={f.id} href={href} className="bg-[#1c1a12] border border-slate-800 hover:border-[#f2b90d] rounded-xl overflow-hidden transition-colors group">
                                        <div className="aspect-[4/5] bg-slate-900 overflow-hidden">
                                            {f.photo_url ? <img src={f.photo_url} alt={f.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-serif text-slate-700">{f.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>}
                                        </div>
                                        <div className="p-3">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${partyColor(f.party)}`}>{f.party} · {f.district_state}</p>
                                            <h4 className="font-serif text-lg font-bold leading-tight text-white">{f.name}</h4>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{f.office_held}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const sides = [p1Profile, p2Profile].map(profile => {
        const p = profile.politician;
        const d = profile.derivedScores;
        return {
            p,
            trust: d.trustScore as number | null,
            rulings: profile.factChecks.length,
            falseRulings: d.trustFalseRulings as number,
            breakdown: d.trustBreakdown as Record<string, number>,
            consistency: d.consistencyScore as number | null,
            promiseRate: d.promiseKeepsRate as number | null,
            promises: profile.promises.length,
            popularity: (p.popularity_score ?? 0) as number,
            latest: profile.factChecks.slice(0, 3),
        };
    });

    const Bar = ({ value }: { value: number | null }) => (
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div className={`h-full ${metricColor(value)}`} style={{ width: `${value ?? 0}%` }}></div>
        </div>
    );

    const Metric = ({ title, note, get, suffix = "" }: { title: string; note: string; get: (s: typeof sides[number]) => number | null; suffix?: string }) => (
        <div>
            <div className="flex justify-between text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400 mb-1"><span>{title}</span></div>
            <p className="text-[11px] text-slate-500 mb-4">{note}</p>
            <div className="grid grid-cols-2 gap-8">
                {sides.map((s, i) => {
                    const v = get(s);
                    return (
                        <div key={i} className="space-y-2">
                            <Bar value={v} />
                            <div className="flex justify-between items-baseline">
                                <span className="text-xl font-serif font-bold text-slate-200">{v === null ? "Not enough data" : `${v}${suffix}`}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="bg-[#12110a] text-slate-100 min-h-screen font-sans antialiased w-full relative pb-16">
            <div className="container mx-auto max-w-5xl px-4 md:px-8 py-8 md:py-16">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="font-serif text-4xl md:text-5xl font-black tracking-tighter uppercase text-white">The Head-to-Head</h2>
                    <Link href="/borg-record/compare" className="text-xs uppercase tracking-widest font-bold text-[#f2b90d] hover:text-white transition-colors flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Change matchup</Link>
                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-8 mb-12">
                    {sides.map((s, i) => (
                        <Link key={i} href={`/borg-record/politicians/${s.p.slug}`} className="flex flex-col gap-3 group">
                            <div className={`aspect-[3/4] md:aspect-square rounded-xl overflow-hidden relative border-2 ${i === 0 ? "border-[#f2b90d]/30" : "border-slate-700/50"} group-hover:border-[#f2b90d] transition-colors bg-slate-900`}>
                                {s.p.photo_url ? <img alt={s.p.name} className="w-full h-full object-cover object-top" src={s.p.photo_url} /> : <div className="w-full h-full flex items-center justify-center text-6xl font-serif text-slate-700">{s.p.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                    <p className={`${partyColor(s.p.party)} text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1`}>{s.p.party} · {s.p.district_state}</p>
                                    <h4 className="font-serif text-2xl md:text-4xl leading-tight font-bold text-white">{s.p.name}</h4>
                                    <p className="text-[10px] text-slate-300 uppercase tracking-wider mt-1">{s.p.office_held}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="bg-[#1c1a12] rounded-xl border-2 border-[#f2b90d]/20 p-6 md:p-10 mb-12 shadow-2xl space-y-10">
                    <h3 className="font-serif text-2xl md:text-3xl flex items-center gap-3 text-white"><ShieldCheck className="h-7 w-7 text-[#f2b90d]" /> The Record</h3>
                    <Metric title="Trust score" note={`100 minus the average falseness of PolitiFact rulings. Needs at least ${MIN_RULINGS_FOR_TRUST} rulings.`} get={s => s.trust} />
                    <Metric title="Consistency score" note="Position reversals across tracked topics. Needs at least 2 topics with multiple statements." get={s => s.consistency} />
                    <Metric title="Promise keep rate" note="Fulfilled promises as a share of resolved promises." get={s => s.promiseRate} suffix="%" />
                    <Metric title="Public attention" note="Wikipedia views over the last 30 days plus recent Daily Borg headline mentions, scaled 0 to 100." get={s => s.popularity} />
                </div>

                <section className="mb-16">
                    <h3 className="font-serif text-3xl mb-8 border-b border-slate-800 pb-4 flex items-center gap-3"><Flame className="w-6 h-6 text-[#ff4d00]" /> Published Rulings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sides.map((s, i) => (
                            <div key={i} className="bg-[#1c1a12] p-6 rounded-xl border border-[#f2b90d]/10">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-lg font-bold">{s.p.name}</span>
                                    <span className="text-xs text-slate-500 uppercase tracking-widest">{s.rulings} ruling{s.rulings === 1 ? "" : "s"}</span>
                                </div>
                                {s.rulings === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No PolitiFact rulings recorded for this official yet.</p>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {Object.entries(s.breakdown).map(([rating, count]) => (
                                                <span key={rating} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${rating === "pants_on_fire" || rating === "false" ? "bg-[#490006] text-[#ffa8a3]" : rating === "mostly_false" ? "bg-[#462400] text-[#ffc697]" : "bg-slate-800 text-slate-300"}`}>{RATING_LABEL[rating] || rating}: {count}</span>
                                            ))}
                                        </div>
                                        <ul className="space-y-3">
                                            {s.latest.map((fc: any) => (
                                                <li key={fc.id} className="text-sm border-l-2 border-[#fe8f00] pl-3">
                                                    <span className="block text-[10px] uppercase tracking-widest text-slate-500">{RATING_LABEL[fc.rating] || fc.rating} · {fc.date}</span>
                                                    <span className="text-slate-200 italic">&quot;{fc.statement}&quot;</span>
                                                    {fc.source_url && <a href={fc.source_url} target="_blank" rel="noopener noreferrer" className="block text-[10px] uppercase tracking-widest text-[#ff906d] hover:text-[#ffc697] mt-1">Source <Eye className="inline w-3 h-3" /></a>}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
