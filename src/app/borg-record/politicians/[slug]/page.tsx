export const runtime = "edge";

import { NewsGrid } from "@/components/ui/grid";
import { CheckCircle2, XCircle, AlertCircle, ArrowRightLeft, ArrowUpRight, Flame, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import CredibilityChart from "@/components/CredibilityChart";
import StanceTimeline from "@/components/StanceTimeline";
import TrustworthinessChart from "@/components/TrustworthinessChart";
import { BorgAlertSubscribe } from "@/components/BorgAlertSubscribe";
import CommentSection from "@/components/CommentSection";
import FollowPoliticianButton from "@/components/FollowPoliticianButton";
import { notFound } from "next/navigation";
import { PoliticianService, ShiftEvent, MIN_RULINGS_FOR_TRUST } from "@/lib/services/politician-service";

const RATING_LABEL: Record<string, string> = {
    true: "True", mostly_true: "Mostly True", half_true: "Half True", mostly_false: "Mostly False", false: "False", pants_on_fire: "Pants on Fire",
};
const SOURCE_LABEL: Record<string, string> = {
    "congress-legislators": "United States Congress roster (unitedstates/congress-legislators)",
    executive: "United States executive branch roster (unitedstates/congress-legislators)",
    openstates: "OpenStates people database",
    request: "Reader request verified against Wikidata",
    legacy: "Earlier Daily Borg import",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const profile = await PoliticianService.getProfile(slug);
    if (!profile) return { title: "Official not found | The Daily Borg" };
    const p = profile.politician;
    return {
        title: `${p.name} (${p.party}, ${p.district_state}) | Borg Record`,
        description: `${p.name}, ${p.office_held}. Public record, published fact-check rulings and trust score on The Daily Borg.`,
    };
}

export default async function PoliticianProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const profile = await PoliticianService.getProfile(slug);
    if (!profile) return notFound();

    const { politician, promises, methodology, derivedScores, claims, evidenceMap, aiStanceChanges, trustHistory, recentVotes, voteStats, factChecks } = profile;
    const trustScore = derivedScores.trustScore as number | null;
    const falseRulings = derivedScores.trustFalseRulings as number;

    const getPromiseStyles = (status: string) => {
        switch (status) {
            case "Fulfilled": return { Icon: CheckCircle2, color: "text-success", iconColor: "text-success" };
            case "In Progress": return { Icon: AlertCircle, color: "text-accent", iconColor: "text-accent" };
            case "Broken":
            case "Reversed": return { Icon: XCircle, color: "text-destructive", iconColor: "text-destructive" };
            default: return { Icon: AlertCircle, color: "text-muted-foreground", iconColor: "text-muted-foreground" };
        }
    };

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: politician.name,
        jobTitle: politician.office_held,
        image: politician.photo_url || undefined,
        url: `https://dailyborg.com/borg-record/politicians/${politician.slug}`,
        sameAs: politician.wikipedia_title ? [`https://en.wikipedia.org/wiki/${encodeURIComponent(String(politician.wikipedia_title).replace(/ /g, "_"))}`] : undefined,
    };

    return (
        <div className="container mx-auto px-4 md:px-8 py-8 md:py-16">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            {politician.candidate_status === "Former" && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 mb-8 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-red-500 font-black uppercase tracking-widest text-xs mb-1">Former Official</h3>
                        <p className="text-muted-foreground text-sm">This person no longer holds the office listed. The profile is kept for the historical record.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-8 mb-12 items-start">
                <div className="w-full md:w-1/3 lg:w-1/4">
                    <div className="aspect-[3/4] bg-muted/30 w-full border-[3px] border-foreground flex items-center justify-center relative overflow-hidden group">
                        {politician.photo_url ? (
                            <img src={politician.photo_url} alt={politician.name} className="absolute inset-0 w-full h-full object-cover object-top grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                        ) : (
                            <span className="text-muted-foreground font-serif italic text-sm absolute bottom-4 right-4">No public photo</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/90 to-transparent pointer-events-none z-10"></div>
                    </div>

                    <div className="mt-6 flex flex-col gap-4">
                        <div className="group relative cursor-help">
                            <div className="flex justify-between items-end mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Trust Score</span>
                                <span className="text-xs font-bold font-serif">{trustScore !== null ? `${trustScore} / 100` : "Not enough data"}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted overflow-hidden relative">
                                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-1000 ease-out" style={{ width: `${trustScore ?? 0}%` }} />
                            </div>
                            <div className="absolute top-10 left-0 w-full bg-popover text-popover-foreground text-xs p-2 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none border border-border">
                                100 minus the average falseness of this official&apos;s published PolitiFact rulings. Shown once at least {MIN_RULINGS_FOR_TRUST} rulings exist.
                            </div>
                        </div>

                        <div className="group relative cursor-help border-t border-border/50 pt-4">
                            <div className="flex justify-between items-end mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-[#fe8f00] transition-colors flex items-center gap-1">
                                    <Flame className="w-3 h-3" /> False Rulings
                                </span>
                                <span className="text-xs font-bold font-serif text-[#fe8f00]">{falseRulings} of {factChecks.length}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted overflow-hidden relative">
                                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#fe8f00] to-[#ff0000] transition-all duration-1000 ease-out" style={{ width: `${factChecks.length > 0 ? Math.round((falseRulings / factChecks.length) * 100) : 0}%` }} />
                            </div>
                            <div className="absolute top-14 left-0 w-full bg-popover text-popover-foreground text-xs p-2 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none border border-border">
                                Rulings of Mostly False, False or Pants on Fire, out of every PolitiFact ruling we hold for this official.
                            </div>
                        </div>

                        <FollowPoliticianButton politicianId={politician.id} />
                    </div>
                </div>

                <div className="w-full md:w-2/3 lg:w-3/4 space-y-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] border w-fit px-3 py-1.5 ${politician.party === "Democrat" ? "text-blue-500 border-blue-500/50 bg-blue-500/5" : politician.party === "Republican" ? "text-red-500 border-red-500/50 bg-red-500/5" : "text-accent border-accent/50 bg-accent/5"}`}>{politician.party}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Status: <span className="text-foreground">{politician.candidate_status === "Former" ? "Former" : politician.time_in_office || "Serving"}</span></span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{politician.region_level}</span>
                    </div>
                    <h1 className="font-serif text-6xl md:text-7xl lg:text-[5rem] font-black tracking-tighter leading-[0.9] text-foreground">{politician.name}</h1>
                    <p className="text-xl md:text-2xl text-muted-foreground font-serif leading-relaxed italic border-l-4 border-accent pl-4">
                        {politician.office_held} • {politician.district_state}
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-8 border-t-[3px] border-foreground w-full">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-2">Rulings Recorded</p>
                            <p className="text-5xl md:text-6xl font-serif font-black text-foreground tracking-tighter">{factChecks.length}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-2">Public Attention</p>
                            <p className="text-5xl md:text-6xl font-serif font-black text-foreground tracking-tighter">{politician.popularity_score ?? 0}<span className="text-2xl md:text-3xl text-muted-foreground tracking-normal font-bold">/100</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center text-muted-foreground mb-2">Promise Keep Rate{derivedScores.promiseKeepsRate === null && <AlertCircle className="w-3 h-3 ml-1 text-accent" />}</p>
                            <p className="text-5xl md:text-6xl font-serif font-black text-foreground tracking-tighter">
                                {derivedScores.promiseKeepsRate !== null ? `${derivedScores.promiseKeepsRate}%` : <span className="text-2xl italic text-muted-foreground font-medium">Not enough data</span>}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center text-muted-foreground mb-2">Consistency Score{derivedScores.consistencyScore === null && <AlertCircle className="w-3 h-3 ml-1 text-accent" />}</p>
                            <p className="text-5xl md:text-6xl font-serif font-black text-foreground tracking-tighter">
                                {derivedScores.consistencyScore !== null ? <>{derivedScores.consistencyScore}<span className="text-2xl md:text-3xl text-muted-foreground tracking-normal font-bold">/100</span></> : <span className="text-2xl italic text-muted-foreground font-medium">Not enough data</span>}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <NewsGrid>
                <div className="col-span-1 md:col-span-4 lg:col-span-8 space-y-16">
                    <section>
                        <TrustworthinessChart
                            politicianName={politician.name}
                            trustworthinessScore={trustScore}
                            promisesKept={politician.promises_kept ?? 0}
                            promisesBroken={politician.promises_broken ?? 0}
                            promisesTotal={politician.promises_total ?? 0}
                            history={trustHistory || []}
                        />
                    </section>

                    <section>
                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8">Published Fact-Check Rulings</h2>
                        {factChecks.length === 0 ? (
                            <div className="p-8 border border-border bg-muted/10 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg opacity-80">No PolitiFact rulings on record for this official yet. Rulings are collected every six hours.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {factChecks.map((fc: any) => (
                                    <div key={fc.id} className="p-5 border border-border bg-background flex flex-col gap-2 hover:border-foreground/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 ${fc.rating === "pants_on_fire" || fc.rating === "false" ? "bg-destructive/15 text-destructive" : fc.rating === "mostly_false" ? "bg-[#fe8f00]/15 text-[#c96d00]" : fc.rating === "half_true" ? "bg-muted text-muted-foreground" : "bg-success/15 text-success"}`}>{RATING_LABEL[fc.rating] || fc.rating}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{fc.date}</span>
                                        </div>
                                        <p className="font-serif font-bold text-xl leading-snug">&quot;{fc.statement}&quot;</p>
                                        {fc.analysis_text && <p className="text-sm text-foreground/80">{fc.analysis_text}</p>}
                                        {fc.source_url && (
                                            <a href={fc.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-1 w-fit">Read the ruling at PolitiFact <ExternalLink className="w-3 h-3" /></a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8">Roll-Call Votes</h2>
                        {voteStats && voteStats.total > 0 && (
                            <p className="text-sm text-muted-foreground font-serif mb-6">
                                {voteStats.total} recorded roll-call vote{voteStats.total === 1 ? "" : "s"} on file: {voteStats.yeas} Yea, {voteStats.nays} Nay, {voteStats.missed} not voting.
                                {voteStats.attendanceRate !== null && <> Attendance {voteStats.attendanceRate}%.</>}
                            </p>
                        )}
                        {(!recentVotes || recentVotes.length === 0) ? (
                            <div className="p-8 border border-border bg-muted/10 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg opacity-80">No roll-call votes are recorded for this official yet. Federal votes are collected hourly from the House Clerk and the Senate and cross-checked before they appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentVotes.map((vote: any, i: number) => {
                                    const badge = vote.verification === "verified" ? "Verified: House Clerk and congress.gov agree"
                                        : vote.verification === "senate_xml" ? "Checked: senate.gov document and vote menu agree"
                                        : vote.verification ? `Verification: ${vote.verification}` : null;
                                    return (
                                        <div key={vote.id || i} className="p-5 border border-border bg-background flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:border-foreground/30 transition-colors">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                                                    {vote.vote_date}{vote.chamber ? ` · ${vote.chamber}` : ""}{vote.roll_number ? ` · Roll ${vote.roll_number}` : ""}{vote.bill_label ? ` · ${vote.bill_label}` : ""}
                                                </p>
                                                <h3 className="font-serif font-bold text-xl">{vote.question ? `${vote.question}: ` : ""}{vote.title}</h3>
                                                <p className="text-sm text-foreground/80 font-serif">
                                                    {vote.result}{typeof vote.yeas === "number" ? ` (${vote.yeas} to ${vote.nays}${vote.not_voting ? `, ${vote.not_voting} not voting` : ""})` : ""}
                                                </p>
                                                {badge && <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{badge}</p>}
                                                <p className="text-[10px] uppercase tracking-widest space-x-3">
                                                    {vote.url && <a href={vote.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{vote.chamber === "Senate" ? "senate.gov" : "House Clerk"}</a>}
                                                    {vote.source_url_secondary && <a href={vote.source_url_secondary} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{vote.chamber === "Senate" ? "Vote menu" : "congress.gov"}</a>}
                                                </p>
                                            </div>
                                            <div className={`px-4 py-2 border font-black uppercase tracking-[0.15em] text-sm shrink-0 ${vote.position === "Yea" ? "bg-success/10 text-success border-success/30" : vote.position === "Nay" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted text-muted-foreground border-border"}`}>{vote.position}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="mb-16"><StanceTimeline politicianName={politician.name} stanceChanges={aiStanceChanges || []} /></div>
                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8">Position Consistency</h2>
                        {derivedScores.consistencyBreakdown.shiftEvents.length === 0 ? (
                            <div className="p-8 border border-border bg-muted/10 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg opacity-80">No documented stance changes for this official.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {derivedScores.consistencyBreakdown.shiftEvents.map((event: ShiftEvent, i: number) => (
                                    <div key={i} className="p-6 md:p-8 border-[1.5px] border-border bg-background relative overflow-hidden group hover:border-accent/40 transition-colors">
                                        <div className={`absolute top-0 right-0 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${event.shift_type === "Contradicted" ? "bg-destructive text-destructive-foreground" : "bg-accent/10 text-accent border-b border-l border-accent/20"}`}>{event.shift_type}</div>
                                        <h3 className="font-serif text-2xl md:text-3xl font-black mb-8 w-5/6 leading-tight tracking-tight">{event.topic}</h3>
                                        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 relative items-start">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-muted-foreground mb-3 block uppercase tracking-[0.15em] border-b border-border/50 pb-2">Previous Stance ({event.previous_date})</span>
                                                <p className="text-foreground/70 font-medium italic border-l-[3px] border-border pl-4 py-1">{event.previous_stance}</p>
                                            </div>
                                            <div className="hidden md:flex mt-8 text-border"><ArrowRightLeft className="w-8 h-8 opacity-50" strokeWidth={1.5} /></div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-muted-foreground mb-3 block uppercase tracking-[0.15em] border-b border-border/50 pb-2">New Stance ({event.new_date})</span>
                                                <p className="text-foreground font-bold border-l-[3px] border-accent pl-4 py-1">{event.new_stance}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="mb-16"><CredibilityChart politicianName={politician.name} claims={claims || []} evidenceMap={evidenceMap || {}} /></div>
                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8 mt-4">Promise Tracker</h2>
                        {promises.length === 0 ? (
                            <div className="p-8 border border-border bg-muted/20 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg">No campaign promises logged for this official yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {promises.map((p: any, i: number) => {
                                    const style = getPromiseStyles(p.status);
                                    const Icon = style.Icon;
                                    return (
                                        <div key={i} className="flex items-start gap-4 p-6 border border-border group hover:bg-muted/30 transition-colors">
                                            <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${style.iconColor}`} />
                                            <div className="w-full">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-serif font-bold text-xl leading-tight pr-4">{p.promise_text}</h3>
                                                    <span className={`text-xs font-bold uppercase tracking-widest whitespace-nowrap ${style.color}`}>{p.status}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mt-4">
                                                    <span>Made: {p.date_said}</span>
                                                    {p.issue_area && <span>Topic: {p.issue_area}</span>}
                                                    {(p.original_statement_url || p.source_url) && (
                                                        <a href={p.original_statement_url || p.source_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center">Original Source <ArrowUpRight className="ml-1 w-3 h-3" /></a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="mt-16 bg-muted/10 border border-border p-8">
                        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                            <AlertCircle className="w-5 h-5 text-accent" />
                            <h3 className="font-serif text-2xl font-bold uppercase tracking-tight">How this record is built</h3>
                        </div>
                        <div className="space-y-4 text-sm text-foreground/80 leading-relaxed max-w-3xl">
                            <p><strong className="text-foreground">Identity and office:</strong> {SOURCE_LABEL[politician.source as string] || "Public roster data"}. Rosters are re-checked every day (federal) or every week (state).</p>
                            <p><strong className="text-foreground">Roll-call votes:</strong> House votes are read from the House Clerk&apos;s XML and published only when congress.gov reports the same result and the same position for every member. Senate votes are read from senate.gov and published only when the vote document and the Senate&apos;s vote menu agree on the tally and result. Disagreements are logged, never shown. No model touches vote data.</p>
                            <p><strong className="text-foreground">Trust score:</strong> 100 minus the average falseness of the official&apos;s PolitiFact rulings (True 0, Mostly True 0.2, Half True 0.5, Mostly False 0.8, False and Pants on Fire 1). Shown once at least {MIN_RULINGS_FOR_TRUST} rulings exist. Every ruling links to PolitiFact.</p>
                            <p><strong className="text-foreground">Consistency score:</strong> {methodology?.formula || "100 minus 15 points per contradiction, divided by the number of topics with multiple statements"}. Needs at least two topics with multiple dated statements.</p>
                            <p><strong className="text-foreground">Public attention:</strong> Wikipedia views over the last 30 days plus recent Daily Borg headline mentions, scaled 0 to 100.</p>
                            <p>No score on this page is produced by a language model. Where the data is thin, the page says &quot;Not enough data&quot; rather than guessing.</p>
                        </div>
                    </section>
                </div>

                <div className="col-span-1 md:col-span-4 lg:col-span-4 space-y-12">
                    <div className="p-10 bg-foreground text-background relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl group-hover:bg-accent/40 transition-colors"></div>
                        <h3 className="font-serif text-4xl font-black mb-4 tracking-tighter">Head-to-Head</h3>
                        <p className="text-background/80 text-sm mb-8 leading-relaxed font-medium">Compare {politician.name}&apos;s published record against another official side by side.</p>
                        <Link href={`/borg-record/compare?p1=${encodeURIComponent(politician.slug)}`} className="w-full bg-background text-foreground hover:bg-accent hover:text-accent-foreground font-black uppercase tracking-[0.2em] text-[10px] py-4 text-center block transition-all border border-transparent hover:border-accent">Choose an Opponent</Link>
                    </div>

                    <BorgAlertSubscribe politicianSlug={slug} politicianName={politician.name} />

                    <div className="p-6 bg-[#111318] border border-[#ff4d00]/30 rounded-xl relative overflow-hidden group shadow-lg">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff4d00]/10 blur-2xl group-hover:bg-[#ff4d00]/20 transition-all"></div>
                        <h3 className="font-serif text-xl font-bold uppercase tracking-tight border-b border-[#fe8f00]/30 pb-3 mb-6 text-white flex items-center"><Flame className="w-5 h-5 mr-2 text-[#ff4d00]" /> Liar Liar Index</h3>
                        <p className="text-[#aaabb0] text-sm mb-4">{falseRulings > 0 ? `${falseRulings} false ruling${falseRulings === 1 ? "" : "s"} on record.` : "No false rulings on record for this official."}</p>
                        <Link href="/borg-record/liar-liar" className="text-xs uppercase font-bold text-[#ff906d] tracking-widest flex items-center hover:text-[#ffc697] transition-colors">View the full index <ArrowUpRight className="ml-1 w-3 h-3" /></Link>
                    </div>

                    <CommentSection pageType="politician" pageSlug={slug} />
                </div>
            </NewsGrid>
        </div>
    );
}
