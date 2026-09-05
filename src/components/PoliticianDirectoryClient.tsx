"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, X, AlertCircle, CheckCircle2, ChevronDown, Award, Loader2 } from "lucide-react";
import { NewsGrid } from "./ui/grid";
import type { PoliticianCard as Politician, Level } from "@/lib/services/politician-service";

type SortOption = "name-asc" | "name-desc" | "trustworthy" | "popular";

const US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
    "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
    "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC", "PR",
];

const STATE_NAMES: Record<string, string> = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
    CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
    IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
    ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
    MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
    OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
    TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington D.C.", PR: "Puerto Rico",
};

const SORT_LABELS: Record<SortOption, string> = {
    "name-asc": "Name (A to Z)",
    "name-desc": "Name (Z to A)",
    "trustworthy": "Highest Trust Score",
    "popular": "Most Viewed",
};

function getTrustBadge(score: number | null | undefined) {
    if (score === null || score === undefined) return { label: "No Rulings Yet", color: "text-muted-foreground bg-muted/30 border-border", icon: "◌" };
    if (score >= 80) return { label: "Highly Trusted", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: "◉" };
    if (score >= 60) return { label: "Mostly Trusted", color: "text-blue-500 bg-blue-500/10 border-blue-500/30", icon: "◉" };
    if (score >= 40) return { label: "Mixed Record", color: "text-amber-500 bg-amber-500/10 border-amber-500/30", icon: "◎" };
    return { label: "Low Trust", color: "text-red-500 bg-red-500/10 border-red-500/30", icon: "◉" };
}

function PoliticianCard({ pol }: { pol: Politician }) {
    const trust = getTrustBadge(pol.trustworthiness_score);
    const [imgFailed, setImgFailed] = useState(false);
    const initials = pol.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

    return (
        <Link href={`/borg-record/politicians/${pol.slug}`} className="col-span-1 md:col-span-2 lg:col-span-3 bg-background border border-border group hover:border-accent hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] duration-500 transition-all block relative overflow-hidden rounded-sm">
            <div className="aspect-[4/5] relative bg-muted/20 overflow-hidden">
                {pol.photo_url && !imgFailed ? (
                    <img
                        src={pol.photo_url}
                        alt={pol.name}
                        loading="lazy"
                        onError={() => setImgFailed(true)}
                        className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 transition-colors">
                        <span className="font-serif text-6xl text-foreground/20 font-black tracking-tighter">{initials}</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent flex flex-col justify-end p-6">
                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] w-fit px-2.5 py-1 mb-3 border backdrop-blur-sm shadow-sm ${trust.color}`}>
                        {trust.icon} {trust.label}{pol.trustworthiness_score !== null ? ` · ${pol.trustworthiness_score}` : ""}
                    </div>
                    {pol.candidate_status === "Former" && (
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] w-fit px-2.5 py-1 mb-3 border backdrop-blur-sm shadow-sm bg-red-500/80 text-white border-red-500/30">
                            ★ Former Official
                        </div>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-widest w-fit px-2.5 py-1 mb-2 shadow-sm rounded-sm backdrop-blur-md ${pol.party === "Democrat" ? "bg-blue-500/80 text-white" : pol.party === "Republican" ? "bg-red-500/80 text-white" : "bg-foreground/80 text-background"}`}>
                        {pol.party}
                    </span>
                    <h3 className="font-serif text-3xl font-bold leading-none mt-2 group-hover:text-accent transition-colors drop-shadow-sm">{pol.name}</h3>
                    <p className="text-xs font-semibold text-muted-foreground mt-2 uppercase tracking-widest drop-shadow-sm">{pol.office_held} <span className="opacity-50 mx-1">•</span> {pol.district_state}</p>
                </div>
            </div>
            <div className="px-6 py-4 bg-background flex justify-between items-center text-xs font-bold uppercase tracking-wider relative z-20">
                <div className="flex items-center gap-3">
                    {pol.promises_total > 0 ? (
                        <span className="text-foreground/70 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-accent" />
                            {pol.promises_kept}/{pol.promises_total} Promises Kept
                        </span>
                    ) : (
                        <span className="text-foreground/50">Public Record</span>
                    )}
                </div>
                <span className="text-muted-foreground group-hover:text-accent transition-colors flex items-center text-[10px] tracking-[0.2em]">View File <ChevronRight className="w-3.5 h-3.5 ml-1" /></span>
            </div>
        </Link>
    );
}

interface Props {
    initialPoliticians: Politician[];
    level: Level;
    state: string | null;
    includeFormer: boolean;
    geoState: string | null;
}

export function PoliticianDirectoryClient({ initialPoliticians, level, state, includeFormer, geoState }: Props) {
    const router = useRouter();

    const [query, setQuery] = useState("");
    const [remoteResults, setRemoteResults] = useState<Politician[] | null>(null);
    const [searching, setSearching] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);
    const [partyFilter, setPartyFilter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("name-asc");

    const [formName, setFormName] = useState("");
    const [formLink, setFormLink] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    useEffect(() => {
        const loadPinned = () => {
            try {
                const saved = localStorage.getItem("tracked_politicians");
                if (saved) setPinnedIds(JSON.parse(saved).filter((p: any) => p.pinned === true).map((p: any) => p.id));
            } catch { /* ignore */ }
        };
        loadPinned();
        window.addEventListener("borg_tracked_officials_update", loadPinned);
        return () => window.removeEventListener("borg_tracked_officials_update", loadPinned);
    }, []);

    // Whole-roster search runs on the server (indexed prefix lookup) once the query has 2+ characters.
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        const q = query.trim();
        if (q.length < 2) { setRemoteResults(null); setSearching(false); return; }
        setSearching(true);
        searchTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/politicians?q=${encodeURIComponent(q)}`);
                const data: any = await res.json();
                setRemoteResults(Array.isArray(data.politicians) ? data.politicians : []);
            } catch {
                setRemoteResults(null);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [query]);

    const navigate = (next: { level?: Level; state?: string | null; former?: boolean }) => {
        const params = new URLSearchParams();
        const l = next.level ?? level;
        const s = next.state === undefined ? state : next.state;
        const f = next.former ?? includeFormer;
        if (l !== "Federal") params.set("level", l);
        if (s && l !== "Federal") params.set("state", s);
        if (f) params.set("former", "1");
        const qs = params.toString();
        router.push(qs ? `/borg-record?${qs}` : "/borg-record");
    };

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base: Politician[] = remoteResults ?? initialPoliticians;
        const result = base.filter(p => {
            const matchesSearch = !q || remoteResults !== null ||
                p.name.toLowerCase().includes(q) ||
                p.district_state.toLowerCase().includes(q) ||
                p.office_held.toLowerCase().includes(q) ||
                (STATE_NAMES[p.district_state.split("-")[0]]?.toLowerCase().includes(q) ?? false);
            const matchesParty = !partyFilter || p.party === partyFilter;
            return matchesSearch && matchesParty;
        });

        result.sort((a, b) => {
            if (pinnedIds.length > 0) {
                const aPinned = pinnedIds.includes(a.id);
                const bPinned = pinnedIds.includes(b.id);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
            }
            switch (sortBy) {
                case "name-asc": return a.name.localeCompare(b.name);
                case "name-desc": return b.name.localeCompare(a.name);
                case "trustworthy": return (b.trustworthiness_score ?? -1) - (a.trustworthiness_score ?? -1);
                case "popular": return (b.popularity_score ?? 0) - (a.popularity_score ?? 0);
                default: return 0;
            }
        });
        return result;
    }, [initialPoliticians, remoteResults, query, partyFilter, sortBy, pinnedIds]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError("");
        try {
            const res = await fetch("/api/requests/politician", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName, email: formEmail, link: formLink }),
            });
            const data: any = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to submit request.");
            setSubmitSuccess(true);
        } catch (err: any) {
            setSubmitError(err.message || "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const scopeLabel = level === "Federal"
        ? "Congress, the President and the Vice President"
        : state
            ? `${STATE_NAMES[state] || state} ${level === "State" ? "legislature" : "local officials"}`
            : `${level} officials (pick a state to see everyone)`;

    return (
        <div className="pb-24">
            <div className="max-w-3xl mb-12">
                <h1 className="font-serif text-5xl md:text-6xl font-black tracking-tight mb-6 leading-none">The Borg Record</h1>
                <p className="text-xl text-muted-foreground font-serif leading-relaxed mb-10 max-w-2xl">
                    The public record of United States officials, built only from official rosters and published fact-check rulings. Every entry links to its source.
                </p>
                <div className="relative group max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search every official by name..."
                        className="w-full bg-background border border-border outline-none pl-12 pr-12 py-4 text-base font-medium rounded-full shadow-sm hover:shadow-md focus:border-accent focus:shadow-md focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-muted-foreground/60"
                    />
                    {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
            </div>

            <div className="mb-10 w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="inline-flex p-1.5 bg-muted/40 backdrop-blur-md rounded-full border border-border/50 shadow-sm max-w-full overflow-x-auto">
                        {(["Federal", "State", "Local"] as Level[]).map(l => {
                            const isActive = level === l && remoteResults === null;
                            return (
                                <button
                                    key={l}
                                    onClick={() => { setQuery(""); navigate({ level: l, state: l === "Federal" ? null : (state || geoState) }); }}
                                    className={`px-8 py-3 rounded-full text-xs md:text-sm font-bold uppercase tracking-[0.15em] transition-all duration-300 relative ${isActive ? "text-background shadow-md" : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"}`}
                                >
                                    {isActive && <span className="absolute inset-0 bg-foreground rounded-full -z-10"></span>}
                                    {l}
                                </button>
                            );
                        })}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mr-4 ml-2">
                        <input
                            type="checkbox"
                            checked={includeFormer}
                            onChange={(e) => navigate({ former: e.target.checked })}
                            className="accent-red-500 w-4 h-4 rounded-sm border-border"
                        />
                        Include former officials
                        {includeFormer && <AlertCircle className="w-3.5 h-3.5 text-red-500 inline ml-1" />}
                    </label>
                </div>

                <div className={`transition-all duration-500 origin-top overflow-hidden ${level !== "Federal" && remoteResults === null ? "max-h-[220px] opacity-100 mb-8" : "max-h-0 opacity-0 mb-0"}`}>
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 border border-border rounded-2xl p-6 backdrop-blur-sm">
                        <label className="font-serif text-lg font-bold text-muted-foreground whitespace-nowrap hidden md:block">Focus state:</label>
                        <div className="relative w-full max-w-sm">
                            <select
                                value={state || ""}
                                onChange={(e) => navigate({ state: e.target.value || null })}
                                className="w-full appearance-none bg-background border border-border rounded-xl py-3 px-5 text-sm font-bold uppercase tracking-widest cursor-pointer shadow-sm hover:border-accent hover:shadow-md transition-all outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
                            >
                                <option value="">Choose a state</option>
                                {US_STATES.map(s => <option key={s} value={s}>{STATE_NAMES[s]} [{s}]</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                        {level === "Local" && (
                            <p className="text-xs text-muted-foreground max-w-sm">
                                City and county officials are added as readers request them and Wikidata confirms the office. State legislatures are complete under the State tab.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="border-t border-border/50 pt-8 mb-8 flex flex-wrap justify-between items-center gap-6">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        {["Democrat", "Republican", "Independent"].map(party => {
                            const isSelected = partyFilter === party;
                            return (
                                <button
                                    key={party}
                                    onClick={() => setPartyFilter(isSelected ? null : party)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border ${isSelected
                                        ? party === "Democrat" ? "bg-blue-600/10 text-blue-600 border-blue-600/30"
                                            : party === "Republican" ? "bg-red-600/10 text-red-600 border-red-600/30"
                                                : "bg-foreground/10 text-foreground border-foreground/30"
                                        : "bg-transparent text-muted-foreground border-border hover:bg-muted"}`}
                                >
                                    {party}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {visible.length} record{visible.length !== 1 ? "s" : ""} · {remoteResults !== null ? "search results" : scopeLabel}
                    </p>
                    <div className="relative z-30">
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border hover:border-foreground transition-colors bg-background"
                        >
                            Sort: {SORT_LABELS[sortBy]}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSortDropdown ? "rotate-180" : ""}`} />
                        </button>
                        {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-2 bg-background border border-border rounded-xl shadow-xl min-w-[220px] overflow-hidden">
                                {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
                                    <button
                                        key={key}
                                        onClick={() => { setSortBy(key); setShowSortDropdown(false); }}
                                        className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-muted/50 transition-colors flex items-center justify-between ${sortBy === key ? "text-accent bg-accent/5" : "text-foreground/80"}`}
                                    >
                                        {SORT_LABELS[key]}
                                        {sortBy === key && <CheckCircle2 className="w-4 h-4 text-accent" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {visible.length > 0 ? (
                <NewsGrid>
                    {visible.map(pol => <PoliticianCard key={pol.id} pol={pol} />)}
                </NewsGrid>
            ) : (
                <div className="py-24 border border-border rounded-3xl bg-muted/5 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                        <AlertCircle className="w-8 h-8 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="font-serif text-3xl font-bold mb-3 tracking-tight">No Records Found</h3>
                    <p className="text-base text-muted-foreground max-w-md mb-8">
                        {query ? `No official matching "${query}" is in the record yet.` : level !== "Federal" && !state ? "Choose a state above to see its officials." : "No officials match these filters."}
                    </p>
                    <div className="w-full max-w-sm h-px bg-border my-6"></div>
                    <button
                        onClick={() => { setFormName(query); setIsModalOpen(true); }}
                        className="bg-foreground text-background font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        Request an Official
                    </button>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-background border border-border rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/40 hover:bg-muted rounded-full" aria-label="Close">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-10 md:p-12">
                            <h2 className="font-serif text-3xl font-bold mb-3 tracking-tight">Request an Official</h2>
                            <p className="text-sm text-muted-foreground mb-10 leading-relaxed max-w-md">
                                Give us the full name of a currently serving United States official. We verify the office against public records (Wikidata) before a profile is created, usually within the hour.
                            </p>
                            {submitSuccess ? (
                                <div className="p-8 bg-success/10 rounded-2xl border border-success/20 text-success flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4"><CheckCircle2 className="w-8 h-8" /></div>
                                    <h3 className="font-bold text-xl mb-2">Request received</h3>
                                    <p className="text-sm opacity-90 max-w-xs mb-8">If the office checks out, the profile goes live and you get an email.</p>
                                    <button onClick={() => setIsModalOpen(false)} className="bg-success text-success-foreground px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all">Close</button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {submitError && <div className="p-4 text-xs font-bold bg-destructive/10 text-destructive rounded-xl text-center">{submitError}</div>}
                                    <div className="space-y-5">
                                        <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required minLength={4} maxLength={80} className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-medium focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/10 outline-none transition-all" placeholder="Official's full name *" />
                                        <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-medium focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/10 outline-none transition-all" placeholder="Your email *" />
                                        <input type="url" value={formLink} onChange={(e) => setFormLink(e.target.value)} className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-medium focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/10 outline-none transition-all" placeholder="Reference link (optional)" />
                                    </div>
                                    <div className="pt-6">
                                        <button type="submit" disabled={isSubmitting} className="w-full bg-foreground text-background font-bold text-xs uppercase tracking-widest py-4 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
                                            {isSubmitting ? "Sending..." : "Submit Request"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showSortDropdown && <div className="fixed inset-0 z-20" onClick={() => setShowSortDropdown(false)} />}
        </div>
    );
}
