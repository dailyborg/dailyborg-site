"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, AlertCircle, CheckCircle2, ChevronDown, Shield, TrendingUp, Award } from "lucide-react";
import { NewsGrid } from "./ui/grid";

type Politician = {
    id: string;
    slug: string;
    name: string;
    office_held: string;
    party: string;
    district_state: string;
    region_level?: string;
    photo_url?: string;
    trustworthiness_score?: number | null;
    promises_kept?: number;
    promises_broken?: number;
    promises_total?: number;
    popularity_score?: number;
    consistency_label: string;
};

type SortOption = 'name-asc' | 'name-desc' | 'trustworthy' | 'promises' | 'popular' | 'newest';

const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
    'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
    'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

const STATE_NAMES: Record<string, string> = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
    CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
    IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
    ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',
    MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
    NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
    OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
    TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
    WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington D.C.'
};

const SORT_LABELS: Record<SortOption, string> = {
    'name-asc': 'Name (A–Z)',
    'name-desc': 'Name (Z–A)',
    'trustworthy': 'Most Trustworthy',
    'promises': 'Most Promises Kept',
    'popular': 'Most Popular',
    'newest': 'Newest Added'
};

function getTrustBadge(score: number | null | undefined) {
    if (score === null || score === undefined) return { label: 'Scoring', color: 'text-muted-foreground bg-muted/30 border-border', icon: '◌' };
    if (score >= 80) return { label: 'Highly Trusted', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30', icon: '◉' };
    if (score >= 60) return { label: 'Mostly Trusted', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30', icon: '◉' };
    if (score >= 40) return { label: 'Mixed Record', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30', icon: '◎' };
    return { label: 'Low Trust', color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: '◉' };
}

export function PoliticianDirectoryClient({ initialPoliticians, initialState }: { initialPoliticians: Politician[], initialState?: string | null }) {
    const validInitialState = initialState && US_STATES.includes(initialState) ? initialState : null;
    
    // Core search
    const [query, setQuery] = useState("");
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    // Filters (Default to State auto-selected using Geo IP)
    const [levelFilter, setLevelFilter] = useState<string | null>(validInitialState ? 'State' : null);
    const [partyFilter, setPartyFilter] = useState<string | null>(null);
    const [stateFilter, setStateFilter] = useState<string | null>(validInitialState);
    const [localTownFilter, setLocalTownFilter] = useState<string>("");
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');


    // Form state
    const [formName, setFormName] = useState("");
    const [formLink, setFormLink] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const activeFilterCount = [levelFilter, partyFilter, stateFilter, localTownFilter].filter(Boolean).length;

    const filteredAndSorted = useMemo(() => {
        let result = initialPoliticians.filter(p => {
            // Text search
            const q = query.toLowerCase();
            const matchesSearch = !q || 
                p.name.toLowerCase().includes(q) ||
                p.district_state.toLowerCase().includes(q) ||
                p.office_held.toLowerCase().includes(q) ||
                (STATE_NAMES[p.district_state.split('-')[0]]?.toLowerCase().includes(q));

            // Level filter
            const matchesLevel = !levelFilter || p.region_level === levelFilter;

            // Party filter
            const matchesParty = !partyFilter || p.party === partyFilter;

            // State filter
            const matchesState = !stateFilter || p.district_state.startsWith(stateFilter);

            // Local town filter
            const matchesTown = !localTownFilter || p.district_state.toLowerCase().includes(localTownFilter.toLowerCase());

            return matchesSearch && matchesLevel && matchesParty && matchesState && matchesTown;
        });

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'trustworthy':
                    return (b.trustworthiness_score ?? -1) - (a.trustworthiness_score ?? -1);
                case 'promises':
                    return (b.promises_kept ?? 0) - (a.promises_kept ?? 0);
                case 'popular':
                    return (b.popularity_score ?? 0) - (a.popularity_score ?? 0);
                case 'newest':
                    return b.id.localeCompare(a.id);
                default:
                    return 0;
            }
        });

        return result;
    }, [initialPoliticians, query, levelFilter, partyFilter, stateFilter, localTownFilter, sortBy]);

    const clearAllFilters = () => {
        setLevelFilter(null);
        setPartyFilter(null);
        setStateFilter(null);
        setLocalTownFilter("");
        setSortBy('name-asc');
    };

    const renderPoliticianCard = (pol: Politician) => {
        const trust = getTrustBadge(pol.trustworthiness_score);
        return (
            <Link key={pol.id} href={`/borg-record/politicians/${pol.slug}`} className="col-span-1 md:col-span-2 lg:col-span-3 border border-border group hover:border-accent transition-all duration-300 block relative overflow-hidden">
                <div className={`aspect-[3/4] relative ${!pol.photo_url ? 'bg-muted' : 'bg-black'}`}>
                    {pol.photo_url && (
                        <img src={pol.photo_url} alt={pol.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent flex flex-col justify-end p-4">
                        {/* Trust Badge */}
                        <div className={`text-[9px] font-black uppercase tracking-[0.2em] w-fit px-2 py-1 mb-2 border ${trust.color}`}>
                            {trust.icon} {trust.label}
                        </div>
                        {/* Party Badge */}
                        <span className={`text-[10px] font-bold uppercase tracking-widest w-fit px-2 py-1 mb-2 ${pol.party === 'Democrat' ? 'bg-blue-500/10 text-blue-500' : pol.party === 'Republican' ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>{pol.party}</span>
                        <h3 className="font-serif text-2xl font-bold leading-tight group-hover:text-accent transition-colors relative z-10">{pol.name}</h3>
                        <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wider relative z-10">{pol.office_held} • {pol.district_state}</p>
                    </div>
                </div>
                {/* Bottom bar with promise stats */}
                <div className="p-4 bg-background border-t border-border flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-3">
                        {pol.promises_total && pol.promises_total > 0 ? (
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Award className="w-3 h-3" />
                                {pol.promises_kept}/{pol.promises_total} kept
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Detailed Record</span>
                        )}
                    </div>
                    <span className="text-foreground group-hover:text-accent transition-colors flex items-center">View <ChevronRight className="w-4 h-4 ml-1" /></span>
                </div>
            </Link>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError("");

        try {
            const res = await fetch('/api/requests/politician', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formName, email: formEmail, link: formLink })
            });

            if (!res.ok) throw new Error("Failed to submit request.");

            setSubmitSuccess(true);
        } catch (err: any) {
            setSubmitError(err.message || "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="max-w-3xl mb-8">
                <h1 className="font-serif text-5xl md:text-6xl font-extrabold tracking-tight mb-6">The Borg Record</h1>
                <p className="text-xl text-muted-foreground font-serif leading-relaxed">
                    The public record, standardized and documented. Search, filter, and sort officials at every level of government — federal, state, and local.
                </p>
                <div className="mt-8 flex max-w-md items-center border-b-2 border-foreground group focus-within:border-accent transition-colors">
                    <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-accent" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, state, or office..."
                        className="w-full bg-transparent border-none outline-none p-3 text-lg font-medium placeholder:font-normal placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            {/* ═══════════════════ STITCH SEGMENTED TABS ═══════════════════ */}
            <div className="flex flex-col md:flex-row w-full mt-12 border-4 border-foreground mb-4 overflow-hidden shadow-sm">
                {['Federal', 'State', 'Local'].map(level => (
                    <button
                        key={level}
                        onClick={() => {
                            // If toggling off, clear state
                            if (levelFilter === level) {
                                setLevelFilter(null);
                            } else {
                                setLevelFilter(level);
                                // Reset logic based on transitions
                                if (level === 'Federal') {
                                   setStateFilter(null);
                                   setLocalTownFilter("");
                                }
                            }
                        }}
                        className={`flex-1 text-center py-5 md:py-6 font-black uppercase tracking-[0.2em] text-sm md:text-xl transition-all duration-300 md:border-r-4 last:border-r-0 border-b-4 md:border-b-0 border-foreground ${levelFilter === level ? 'bg-foreground text-background shadow-inner z-10' : 'bg-transparent text-foreground hover:bg-foreground/5'}`}
                    >
                        {level}
                    </button>
                ))}
            </div>

            {/* Prominent State & Municipality Extenders */}
            {(levelFilter === 'State' || levelFilter === 'Local') && (
                <div className="mb-12 p-6 md:p-8 bg-muted/10 border-b-4 border-foreground animate-in slide-in-from-top-2 flex flex-col lg:flex-row items-center gap-6">
                    <h3 className="font-serif text-3xl font-bold uppercase tracking-tight w-full lg:w-auto text-muted-foreground whitespace-nowrap">
                        {levelFilter === 'Local' ? 'Select Region' : 'Select State'}
                    </h3>
                    
                    <div className="relative w-full">
                        <select
                            value={stateFilter || ""}
                            onChange={(e) => setStateFilter(e.target.value || null)}
                            className="w-full appearance-none bg-background border-4 border-foreground py-4 px-6 text-lg font-black uppercase tracking-[0.1em] cursor-pointer hover:border-accent transition-colors outline-none focus:border-accent focus:ring-0"
                        >
                            <option value="">-- ALL STATES --</option>
                            {US_STATES.map(s => <option key={s} value={s}>{STATE_NAMES[s]} ({s})</option>)}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none text-foreground" />
                    </div>

                    {levelFilter === 'Local' && (
                        <div className="relative w-full">
                            <input 
                                type="text" 
                                placeholder="e.g. Chicago..." 
                                value={localTownFilter} 
                                onChange={(e) => setLocalTownFilter(e.target.value)}
                                className="w-full bg-background border-4 border-foreground py-4 px-6 text-lg font-black uppercase tracking-[0.1em] placeholder:text-muted-foreground/50 hover:border-accent transition-colors outline-none focus:border-accent" 
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════ SECONDARY FILTERS & SORT ROW ═══════════════════ */}
            <div className="border-t-2 border-foreground/20 pt-6 mb-8 mt-4 flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col gap-4 w-full md:w-auto">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Party Filter as Chips */}
                        <div className="flex items-center gap-2 bg-muted/30 p-1.5 border border-border">
                            {['Democrat', 'Republican', 'Independent'].map(party => (
                                <button
                                    key={party}
                                    onClick={() => setPartyFilter(partyFilter === party ? null : party)}
                                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 ${partyFilter === party
                                        ? party === 'Democrat' ? 'bg-blue-600 text-white border-blue-600' : party === 'Republican' ? 'bg-red-600 text-white border-red-600' : 'bg-foreground text-background border-foreground'
                                        : 'bg-transparent text-foreground border-transparent hover:bg-foreground/5'}`}
                                >
                                    {party}
                                </button>
                            ))}
                        </div>

                        {/* Active Filter Clearer */}
                        {activeFilterCount > 0 && (
                            <button onClick={clearAllFilters} className="text-[10px] font-black uppercase tracking-widest text-destructive hover:underline md:ml-4">
                                Clear All ({activeFilterCount})
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    {/* Results count */}
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground pr-4">
                        {filteredAndSorted.length} official{filteredAndSorted.length !== 1 ? 's' : ''} found
                    </p>

                    {/* Sort Dropdown */}
                    <div className="relative z-20">
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] border-2 border-foreground hover:bg-foreground hover:text-background transition-colors"
                        >
                            Sort: {SORT_LABELS[sortBy]}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-1 bg-background border-2 border-foreground shadow-2xl min-w-[240px]">
                                {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
                                    <button
                                        key={key}
                                        onClick={() => { setSortBy(key); setShowSortDropdown(false); }}
                                        className={`w-full text-left px-5 py-4 text-xs font-bold uppercase tracking-widest hover:bg-muted/50 transition-colors flex items-center justify-between ${sortBy === key ? 'text-accent bg-accent/5' : 'text-foreground'}`}
                                    >
                                        {SORT_LABELS[key]}
                                        {sortBy === key && <span className="text-accent">●</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════════ RESULTS GRID ═══════════════════ */}
            {filteredAndSorted.length > 0 ? (
                <NewsGrid>
                    {filteredAndSorted.map(renderPoliticianCard)}
                </NewsGrid>
            ) : (
                <div className="p-12 border-4 border-dashed border-border bg-muted/10 text-center flex flex-col items-center">
                    <AlertCircle className="w-16 h-16 text-muted-foreground mb-6 opacity-30" />
                    <h3 className="font-serif text-4xl font-bold mb-4 uppercase tracking-tight">No Officials Found</h3>
                    <p className="text-lg text-muted-foreground max-w-xl mb-6">
                        {query ? `No results for "${query}"` : 'No officials match the selected filters.'}
                    </p>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="mb-8 border-2 border-foreground px-8 py-3 text-sm font-black uppercase tracking-[0.2em] hover:bg-foreground hover:text-background transition-colors"
                        >
                            Reset All Filters
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setFormName(query);
                            setIsModalOpen(true);
                        }}
                        className="bg-accent text-accent-foreground font-black uppercase tracking-[0.2em] text-sm px-10 py-5 hover:opacity-90 transition-opacity">
                        Submit For Database Indexing
                    </button>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-[0.2em] mt-6">Automated Verification pipeline runs every 2 hours.</p>
                </div>
            )}

            {/* AI Review Submission Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-background border-4 border-foreground w-full max-w-xl shadow-[20px_20px_0px_0px_rgba(0,0,0,0.1)] relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/20 hover:bg-muted/50 rounded-full">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="p-10">
                            <h2 className="font-serif text-4xl font-black mb-4 leading-tight uppercase tracking-tight">System Request</h2>
                            <p className="text-sm text-muted-foreground mb-10 font-medium">Submit an official for indexing. The autonomous verification framework will securely compile their public record and construct a zero-cost Trust Matrix.</p>

                            {submitSuccess ? (
                                <div className="p-8 bg-success/10 border-2 border-success text-success flex flex-col items-center text-center">
                                    <CheckCircle2 className="w-16 h-16 mb-6" />
                                    <h3 className="font-bold text-2xl uppercase tracking-wider mb-2">Request Queued</h3>
                                    <p className="text-sm opacity-80 max-w-xs">We've added this to the ingestion pipeline. You will be pinged via Edge-email once their profile synchronizes.</p>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="mt-8 border-2 border-success px-8 py-3 text-xs font-black uppercase tracking-[0.2em] hover:bg-success hover:text-success-foreground transition-colors">
                                        Return to Directory
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    {submitError && (
                                        <div className="p-4 text-sm font-bold bg-destructive/10 text-destructive border-2 border-destructive uppercase tracking-widest text-center">
                                            ERROR: {submitError}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-foreground mb-3">Official's Exact Name</label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                            className="w-full border-b-2 border-border p-3 focus:border-accent focus:outline-none bg-transparent font-serif text-2xl placeholder:text-muted-foreground/30 transition-colors"
                                            placeholder="e.g. Bernie Sanders"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-foreground mb-3">Your Secure Email</label>
                                        <input
                                            type="email"
                                            value={formEmail}
                                            onChange={(e) => setFormEmail(e.target.value)}
                                            required
                                            className="w-full border-b-2 border-border p-3 focus:border-accent focus:outline-none bg-transparent font-serif text-2xl placeholder:text-muted-foreground/30 transition-colors"
                                            placeholder="you@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-foreground mb-3">Reference Origin (Optional)</label>
                                        <input
                                            type="url"
                                            value={formLink}
                                            onChange={(e) => setFormLink(e.target.value)}
                                            className="w-full border-b-2 border-border p-3 focus:border-accent focus:outline-none bg-transparent font-serif text-2xl placeholder:text-muted-foreground/30 transition-colors"
                                            placeholder="Wikipedia or Campaign Site"
                                        />
                                    </div>

                                    <div className="pt-6">
                                        <p className="text-xs text-muted-foreground italic border-l-4 border-accent pl-4 mb-8 leading-relaxed">
                                            By submitting, you authorize the Daily Borg to issue automated updates the moment verification processing completes.
                                        </p>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-foreground text-background font-black text-sm uppercase tracking-[0.2em] py-5 hover:bg-accent transition-colors disabled:opacity-50">
                                            {isSubmitting ? "Queueing Protocol..." : "Initialize Verification Engine"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Click-away handler for dropdowns */}
            {(showSortDropdown) && (
                <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
            )}
        </>
    );
}
