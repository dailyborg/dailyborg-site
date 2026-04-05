export const runtime = 'edge';

import { NewsGrid } from "@/components/ui/grid";
import { CheckCircle2, XCircle, AlertCircle, ArrowRightLeft, ArrowUpRight, Flame } from "lucide-react";
import Link from "next/link";
import CredibilityChart from "@/components/CredibilityChart";
import StanceTimeline from "@/components/StanceTimeline";
import TrustworthinessChart from "@/components/TrustworthinessChart";
import { BorgAlertSubscribe } from "@/components/BorgAlertSubscribe";

import { notFound } from "next/navigation";
import { PoliticianService, ShiftEvent } from "@/lib/services/politician-service";

export default async function PoliticianProfilePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const profile = await PoliticianService.getProfile(slug);

    if (!profile) {
        return notFound();
    }

    const { politician, promises, methodology, derivedScores, claims, evidenceMap, aiStanceChanges, trustHistory, recentVotes, factChecks } = profile;

    // Helper to get right icon and color for promise status
    const getPromiseStyles = (status: string) => {
        switch (status) {
            case "Fulfilled": return { Icon: CheckCircle2, color: "text-success", iconColor: "text-success" };
            case "In Progress": return { Icon: AlertCircle, color: "text-accent", iconColor: "text-accent" };
            case "Broken":
            case "Reversed": return { Icon: XCircle, color: "text-destructive", iconColor: "text-destructive" };
            default: return { Icon: AlertCircle, color: "text-muted-foreground", iconColor: "text-muted-foreground" };
        }
    };

    return (
        <div className="container mx-auto px-4 md:px-8 py-8 md:py-16">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row gap-8 mb-12 items-start">
                <div className="w-full md:w-1/3 lg:w-1/4">
                    <div className="aspect-[3/4] bg-muted/30 w-full border-[3px] border-foreground flex items-center justify-center relative overflow-hidden group">
                        {politician.photo_url ? (
                            <img src={politician.photo_url} alt={politician.name} className="absolute inset-0 w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                        ) : (
                            <span className="text-muted-foreground font-serif italic text-sm absolute bottom-4 right-4 group-hover:text-accent transition-colors">No Photo</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/90 to-transparent pointer-events-none z-10"></div>
                    </div>
                </div>
                <div className="w-full md:w-2/3 lg:w-3/4 space-y-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] border w-fit px-3 py-1.5 ${politician.party === 'Democrat' ? 'text-blue-500 border-blue-500/50 bg-blue-500/5' : politician.party === 'Republican' ? 'text-red-500 border-red-500/50 bg-red-500/5' : 'text-accent border-accent/50 bg-accent/5'}`}>{politician.party}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">In Office: <span className="text-foreground">{politician.time_in_office}</span></span>
                    </div>
                    <h1 className="font-serif text-6xl md:text-7xl lg:text-[5rem] font-black tracking-tighter leading-[0.9] text-foreground">
                        {politician.name}
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground font-serif leading-relaxed italic border-l-4 border-accent pl-4">
                        {politician.office_held} • {politician.district_state}
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-8 border-t-[3px] border-foreground w-full">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-2">Key Votes Cast</p>
                            <p className="text-4xl md:text-5xl font-serif font-black text-muted-foreground/50 italic">N/A</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-2">Bills Sponsored</p>
                            <p className="text-4xl md:text-5xl font-serif font-black text-muted-foreground/50 italic">N/A</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center text-muted-foreground mb-2">
                                Promise Keeps Rate
                                {derivedScores.promiseKeepsRate === null && <AlertCircle className="w-3 h-3 ml-1 text-accent" />}
                            </p>
                            <p className="text-5xl md:text-6xl font-serif font-black text-foreground tracking-tighter">
                                {derivedScores.promiseKeepsRate !== null ? `${derivedScores.promiseKeepsRate}%` : <span className="text-2xl italic text-muted-foreground font-medium">Not Enough Data</span>}
                            </p>
                            {derivedScores.promiseKeepsRate !== null && (
                                <p className="text-[9px] font-bold uppercase tracking-widest text-accent mt-2">Based on {derivedScores.promiseBreakdown.fulfilled + derivedScores.promiseBreakdown.broken + derivedScores.promiseBreakdown.reversed} Scored Promises</p>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] flex items-center text-muted-foreground mb-2">
                                Consistency Score
                                {derivedScores.consistencyScore === null && <AlertCircle className="w-3 h-3 ml-1 text-accent" />}
                            </p>
                            <p className="text-5xl md:text-6xl font-serif font-black text-foreground tracking-tighter group cursor-help transition-colors hover:text-accent">
                                {derivedScores.consistencyScore !== null ? `${derivedScores.consistencyScore}` : <span className="text-2xl italic text-muted-foreground font-medium">Not Enough Data</span>}
                                {derivedScores.consistencyScore !== null && <span className="text-2xl md:text-3xl text-muted-foreground tracking-normal font-bold">/100</span>}
                            </p>
                            {derivedScores.consistencyScore !== null && (
                                <p className="text-[9px] font-bold uppercase tracking-widest text-accent mt-2">Based on {derivedScores.consistencyBreakdown.eligibleTopics} Topics</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-b-[3px] border-border flex gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground overflow-x-auto no-scrollbar mb-12 pb-4">
                <span className="text-foreground border-b-4 border-foreground pb-4 -mb-[19.5px]">Overview</span>
                <span className="hover:text-foreground cursor-pointer transition-colors pb-4">Promise Tracker</span>
                <span className="hover:text-foreground cursor-pointer transition-colors pb-4">Voting Record</span>
                <span className="hover:text-foreground cursor-pointer transition-colors pb-4">Methodology</span>
            </div>

            <NewsGrid>
                {/* Main Column */}
                <div className="col-span-1 md:col-span-4 lg:col-span-8 space-y-16">

                    {/* Trustworthiness Index Charts */}
                    <section>
                        <TrustworthinessChart
                            politicianName={politician.name}
                            trustworthinessScore={politician.trustworthiness_score ?? null}
                            promisesKept={politician.promises_kept ?? 0}
                            promisesBroken={politician.promises_broken ?? 0}
                            promisesTotal={politician.promises_total ?? 0}
                            history={trustHistory || []}
                        />
                    </section>

                    {/* Recent Legislative Votes */}
                    <section>
                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8">Recent Legislative Votes</h2>
                        {(!recentVotes || recentVotes.length === 0) ? (
                            <div className="p-8 border border-border bg-muted/10 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg opacity-80">No recent legislative votes recorded for this official.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {recentVotes.map((vote: any, i: number) => (
                                    <div key={i} className="p-5 border border-border bg-background flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:border-foreground/30 transition-colors">
                                        <div className="space-y-1 flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{new Date(vote.vote_date).toLocaleDateString()}</p>
                                            <h3 className="font-serif font-bold text-xl">{vote.title}</h3>
                                            {vote.rationale && (
                                                <p className="text-sm text-foreground/80 font-serif italic pt-1">{vote.rationale}</p>
                                            )}
                                        </div>
                                        <div className={`px-4 py-2 border font-black uppercase tracking-[0.15em] text-sm shrink-0 ${vote.position === 'Yea' ? 'bg-success/10 text-success border-success/30' : vote.position === 'Nay' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-muted text-muted-foreground border-border'}`}>
                                            {vote.position}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                    <section>
                        {/* New Stance Timeline Component injected here */}
                        <div className="mb-16">
                            <StanceTimeline politicianName={politician.name} stanceChanges={aiStanceChanges || []} />
                        </div>

                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8">Position Consistency: Reference Points</h2>

                        {derivedScores.consistencyBreakdown.shiftEvents.length === 0 ? (
                            <div className="p-8 border border-border bg-muted/10 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg opacity-80">No significant stance evolutions or contradictions detected in the current record.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {derivedScores.consistencyBreakdown.shiftEvents.map((event: ShiftEvent, i: number) => (
                                    <div key={i} className="p-6 md:p-8 border-[1.5px] border-border bg-background relative overflow-hidden group hover:border-accent/40 transition-colors">
                                        <div className={`absolute top-0 right-0 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${event.shift_type === 'Contradicted' ? 'bg-destructive text-destructive-foreground' : 'bg-accent/10 text-accent border-b border-l border-accent/20'}`}>
                                            {event.shift_type}
                                        </div>
                                        <h3 className="font-serif text-2xl md:text-3xl font-black mb-8 w-5/6 leading-tight tracking-tight group-hover:text-accent transition-colors">{event.topic}</h3>
                                        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 relative items-start">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-muted-foreground mb-3 block uppercase tracking-[0.15em] border-b border-border/50 pb-2">Previous Stance ({event.previous_date})</span>
                                                <p className="text-foreground/70 font-medium italic border-l-[3px] border-border pl-4 py-1">{event.previous_stance}</p>
                                            </div>
                                            <div className="hidden md:flex mt-8 text-border">
                                                <ArrowRightLeft className="w-8 h-8 opacity-50" strokeWidth={1.5} />
                                            </div>
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

                    {/* Promise Tracker */}
                    <section>
                        {/* Credibility Chart injected here */}
                        <div className="mb-16">
                            <CredibilityChart politicianName={politician.name} claims={claims || []} evidenceMap={evidenceMap || {}} />
                        </div>

                        <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter border-b-[3px] border-foreground pb-3 mb-8 mt-4">The Receipt Desk (Legacy Promises)</h2>

                        {promises.length === 0 ? (
                            <div className="p-8 border border-border bg-muted/20 text-center">
                                <p className="text-muted-foreground font-serif italic text-lg">No concrete campaign promises logged for this official yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {promises.map((p: any, i: number) => {
                                    const style = getPromiseStyles(p.status);
                                    const Icon = style.Icon;
                                    return (
                                        <div key={i} className="flex items-start gap-4 p-6 border border-border group cursor-pointer hover:bg-muted/30 transition-colors">
                                            <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${style.iconColor}`} />
                                            <div className="w-full">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-serif font-bold text-xl leading-tight group-hover:text-accent transition-colors pr-4">{p.promise_text}</h3>
                                                    <span className={`text-xs font-bold uppercase tracking-widest whitespace-nowrap ${style.color}`}>{p.status}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mt-4">
                                                    <span>Made: {p.date_said}</span>
                                                    {p.issue_area && <span>Topic: {p.issue_area}</span>}
                                                    {p.original_statement_url && (
                                                        <a href={p.original_statement_url} target="_blank" className="text-accent hover:underline flex items-center">
                                                            Original Source <ArrowUpRight className="ml-1 w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Transparency & Methodology Explanation */}
                    <section className="mt-16 bg-muted/10 border border-border p-8">
                        <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                            <AlertCircle className="w-5 h-5 text-accent" />
                            <h3 className="font-serif text-2xl font-bold uppercase tracking-tight">Active Methodology</h3>
                        </div>
                        {methodology ? (
                            <div className="space-y-4 text-sm text-foreground/80 leading-relaxed max-w-3xl">
                                <p><strong className="text-foreground">Version:</strong> {methodology.version_name}</p>
                                <p>{methodology.description}</p>
                                <div className="p-4 bg-background border border-border font-mono text-xs text-muted-foreground mt-4 overflow-x-auto">
                                    <span className="block mb-2 text-foreground font-bold font-sans uppercase tracking-widest border-b border-border pb-2">Scoring Engine Formulation</span>
                                    {methodology.formula}
                                </div>
                                <div className="mt-6 pt-4 border-t border-border/50 text-xs">
                                    <p className="font-bold uppercase tracking-widest mb-2">How we define shifts:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li><strong>Evolution:</strong> A change in intensity without reversing course (e.g., Support to Strongly Support).</li>
                                        <li><strong>Contradiction:</strong> A structural reversal in stance spanning across neutrality (e.g., Support to Oppose). Deducts 15 base points.</li>
                                        <li><strong>Not Enough Data:</strong> Scores require minimum thresholds. Promises need at least 1 resolved resolution. Consistency requires at least 2 distinct topics with multiple stances over time.</li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground italic">No public methodology version is currently bound to this environment.</p>
                        )}
                    </section>

                </div>

                {/* Sidebar */}
                <div className="col-span-1 md:col-span-4 lg:col-span-4 space-y-12">
                    {/* Comparison Promo */}
                    <div className="p-10 bg-foreground text-background relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl group-hover:bg-accent/40 transition-colors"></div>
                        <h3 className="font-serif text-4xl font-black mb-4 tracking-tighter">The Matrix</h3>
                        <p className="text-background/80 text-sm mb-8 leading-relaxed font-medium">Compare {politician.name}'s voting record and position consistency against another official side-by-side to expose voting parallels.</p>
                        <Link href="/borg-record/compare" className="w-full bg-background text-foreground hover:bg-accent hover:text-accent-foreground font-black uppercase tracking-[0.2em] text-[10px] py-4 text-center block transition-all border border-transparent hover:border-accent">Select Opponent</Link>
                    </div>

                    {/* Borg Alerts Integration */}
                    <BorgAlertSubscribe politicianSlug={slug} politicianName={politician.name} />

                    {/* Recent Votes */}
                    <div className="p-6 border border-border bg-muted/10">
                        <h3 className="font-serif text-xl font-bold uppercase tracking-tight border-b-2 border-border pb-3 mb-6">Recent Key Votes</h3>
                        <div className="space-y-6">
                            <div className="border-l-4 border-success pl-4">
                                <span className="text-[10px] font-bold text-success uppercase tracking-widest block mb-1">YEA</span>
                                <p className="font-bold text-sm leading-snug hover:text-accent cursor-pointer transition-colors">H.R. 432 - Infrastructure Resilience</p>
                            </div>
                            <div className="border-l-4 border-destructive pl-4">
                                <span className="text-[10px] font-bold text-destructive uppercase tracking-widest block mb-1">NAY</span>
                                <p className="font-bold text-sm leading-snug hover:text-accent cursor-pointer transition-colors">S.B. 12 - Technology Antitrust Breakup</p>
                            </div>
                            <div className="border-l-4 border-accent pl-4">
                                <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-1">PRESENT</span>
                                <p className="font-bold text-sm leading-snug hover:text-accent cursor-pointer transition-colors">S.Res 44 - Budget Adjustments</p>
                            </div>
                        </div>
                    </div>

                    {/* Fact Checks / Lies */}
                    <div className="p-6 bg-[#111318] border border-[#ff4d00]/30 rounded-xl relative overflow-hidden group shadow-lg mt-8">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff4d00]/10 blur-2xl group-hover:bg-[#ff4d00]/20 transition-all"></div>
                        <h3 className="font-serif text-xl font-bold uppercase tracking-tight border-b border-[#fe8f00]/30 pb-3 mb-6 text-white flex items-center">
                            <Flame className="w-5 h-5 mr-2 text-[#ff4d00]" /> 
                            Forensic Truth Log
                        </h3>
                        {factChecks && factChecks.length > 0 ? (
                            <div className="space-y-4">
                                {factChecks.map((fc: any) => (
                                    <div key={fc.id} className="border-l-2 pl-3 border-[#fe8f00]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${fc.rating === 'pants_on_fire' ? 'bg-[#ff0000]/20 text-[#ff716c]' : 'bg-[#fe8f00]/20 text-[#ffc697]'}`}>
                                                {fc.rating === 'pants_on_fire' ? 'PANTS ON FIRE' : 'FALSEHOOD'}
                                            </span>
                                            <span className="text-[10px] text-[#74757a]">{fc.date}</span>
                                        </div>
                                        <p className="font-medium text-sm text-[#f9f9ff] italic leading-snug">"{fc.statement}"</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[#aaabb0] italic text-sm">No false statements currently tracked for this official.</p>
                        )}
                        <div className="mt-6 pt-4 border-t border-[#46484d]/50">
                            <Link href="/borg-record/liar-liar" className="text-xs uppercase font-bold text-[#ff906d] tracking-widest flex items-center hover:text-[#ffc697] transition-colors">
                                View Full Index <ArrowUpRight className="ml-1 w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                </div>
            </NewsGrid>
        </div>
    );
}
