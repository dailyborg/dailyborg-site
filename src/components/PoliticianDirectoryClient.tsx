"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, AlertCircle, CheckCircle2, ChevronDown, SlidersHorizontal, Shield, TrendingUp, Award } from "lucide-react";
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

export function PoliticianDirectoryClient({ initialPoliticians }: { initialPoliticians: Politician[] }) {
    const [query, setQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Filter state
    const [levelFilter, setLevelFilter] = useState<string | null>(null);
    const [partyFilter, setPartyFilter] = useState<string | null>(null);
    const [stateFilter, setStateFilter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showStateDropdown, setShowStateDropdown] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formLink, setFormLink] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const activeFilterCount = [levelFilter, partyFilter, stateFilter].filter(Boolean).length;

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

            return matchesSearch && matchesLevel && matchesParty && matchesState;
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
    }, [initialPoliticians, query, levelFilter, partyFilter, stateFilter, sortBy]);

    const clearAllFilters = () => {
        setLevelFilter(null);
        setPartyFilter(null);
        setStateFilter(null);
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
            <div className="max-w-3xl mb-12">
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

            {/* ═══════════════════ FILTER & SORT BAR ═══════════════════ */}
            <div className="border-t-4 border-foreground pt-6 mb-8 mt-16">
                <div className="flex flex-col gap-4">
                    {/* Top row: title + controls */}
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <h2 className="font-serif text-3xl font-bold uppercase tracking-tight">Active Profiles</h2>
                        <div className="flex items-center gap-3">
                            {/* Filter Toggle */}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] border transition-all duration-200 ${showFilters ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground border-border hover:border-foreground'}`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                Filters
                                {activeFilterCount > 0 && (
                                    <span className="bg-accent text-accent-foreground w-5 h-5 flex items-center justify-center text-[10px] font-black">{activeFilterCount}</span>
                                )}
                            </button>

                            {/* Sort Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] border border-border hover:border-foreground transition-colors"
                                >
                                    Sort: {SORT_LABELS[sortBy]}
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showSortDropdown && (
                                    <div className="absolute right-0 top-full mt-1 z-40 bg-background border-2 border-foreground shadow-2xl min-w-[220px]">
                                        {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
                                            <button
                                                key={key}
                                                onClick={() => { setSortBy(key); setShowSortDropdown(false); }}
                                                className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-muted/50 transition-colors flex items-center justify-between ${sortBy === key ? 'text-accent bg-accent/5' : 'text-foreground'}`}
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

                    {/* Filter Row (collapsible) */}
                    {showFilters && (
                        <div className="flex flex-wrap gap-3 py-4 px-5 bg-muted/10 border border-border animate-in slide-in-from-top-2 duration-200">
                            {/* Level Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mr-1">Level</span>
                                {['Federal', 'State', 'Local'].map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setLevelFilter(levelFilter === level ? null : level)}
                                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 ${levelFilter === level ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/70 border-border hover:border-foreground/50'}`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>

                            {/* Divider */}
                            <div className="w-px h-8 bg-border self-center hidden md:block" />

                            {/* Party Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mr-1">Party</span>
                                {['Democrat', 'Republican', 'Independent'].map(party => (
                                    <button
                                        key={party}
                                        onClick={() => setPartyFilter(partyFilter === party ? null : party)}
                                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 ${partyFilter === party
                                            ? party === 'Democrat' ? 'bg-blue-600 text-white border-blue-600' : party === 'Republican' ? 'bg-red-600 text-white border-red-600' : 'bg-foreground text-background border-foreground'
                                            : 'bg-transparent text-foreground/70 border-border hover:border-foreground/50'}`}
                                    >
                                        {party}
                                    </button>
                                ))}
                            </div>

                            {/* Divider */}
                            <div className="w-px h-8 bg-border self-center hidden md:block" />

                            {/* State Dropdown */}
                            <div className="relative flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mr-1">State</span>
                                <button
                                    onClick={() => setShowStateDropdown(!showStateDropdown)}
                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 flex items-center gap-1.5 ${stateFilter ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-foreground/70 border-border hover:border-foreground/50'}`}
                                >
                                    {stateFilter ? STATE_NAMES[stateFilter] || stateFilter : 'All States'}
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showStateDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showStateDropdown && (
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-background border-2 border-foreground shadow-2xl max-h-64 overflow-y-auto min-w-[200px]">
                                        <button
                                            onClick={() => { setStateFilter(null); setShowStateDropdown(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-muted/50 transition-colors ${!stateFilter ? 'text-accent' : ''}`}
                                        >
                                            All States
                                        </button>
                                        {US_STATES.map(st => (
                                            <button
                                                key={st}
                                                onClick={() => { setStateFilter(st); setShowStateDropdown(false); }}
                                                className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-muted/50 transition-colors flex justify-between ${stateFilter === st ? 'text-accent bg-accent/5' : 'text-foreground'}`}
                                            >
                                                <span>{STATE_NAMES[st]}</span>
                                                <span className="text-muted-foreground">{st}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Active Filter Chips */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Active:</span>
                            {levelFilter && (
                                <button onClick={() => setLevelFilter(null)} className="flex items-center gap-1.5 px-3 py-1 bg-foreground/5 border border-foreground/20 text-xs font-bold uppercase tracking-widest hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors">
                                    {levelFilter} <X className="w-3 h-3" />
                                </button>
                            )}
                            {partyFilter && (
                                <button onClick={() => setPartyFilter(null)} className="flex items-center gap-1.5 px-3 py-1 bg-foreground/5 border border-foreground/20 text-xs font-bold uppercase tracking-widest hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors">
                                    {partyFilter} <X className="w-3 h-3" />
                                </button>
                            )}
                            {stateFilter && (
                                <button onClick={() => setStateFilter(null)} className="flex items-center gap-1.5 px-3 py-1 bg-foreground/5 border border-foreground/20 text-xs font-bold uppercase tracking-widest hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors">
                                    {STATE_NAMES[stateFilter] || stateFilter} <X className="w-3 h-3" />
                                </button>
                            )}
                            <button onClick={clearAllFilters} className="text-[10px] font-black uppercase tracking-widest text-destructive hover:underline ml-2">
                                Clear All
                            </button>
                        </div>
                    )}

                    {/* Results count */}
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        {filteredAndSorted.length} official{filteredAndSorted.length !== 1 ? 's' : ''} found
                    </p>
                </div>
            </div>

            {/* ═══════════════════ RESULTS GRID ═══════════════════ */}
            {filteredAndSorted.length > 0 ? (
                <NewsGrid>
                    {filteredAndSorted.map(renderPoliticianCard)}
                </NewsGrid>
            ) : (
                <div className="p-12 border-2 border-dashed border-border bg-muted/10 text-center flex flex-col items-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="font-serif text-3xl font-bold mb-4">No Officials Found</h3>
                    <p className="text-lg text-muted-foreground max-w-xl mb-4">
                        {query ? `No results for "${query}"` : 'No officials match the selected filters.'}
                    </p>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="mb-6 border border-border px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
                        >
                            Clear All Filters
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setFormName(query);
                            setIsModalOpen(true);
                        }}
                        className="bg-foreground text-background font-bold uppercase tracking-widest text-sm px-8 py-4 hover:bg-accent transition-colors">
                        Submit for AI Review
                    </button>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-4">Automated Verification typically takes ~2 hours.</p>
                </div>
            )}

            {/* AI Review Submission Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background border-[3px] border-foreground w-full max-w-lg shadow-2xl relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="p-8">
                            <h2 className="font-serif text-3xl font-black mb-2 leading-tight">Request Profile Initialization</h2>
                            <p className="text-sm text-muted-foreground mb-8">Submit this official for indexing. Our AI network will securely verify their public record and construct their Consistency Matrix.</p>

                            {submitSuccess ? (
                                <div className="p-6 bg-success/10 border border-success text-success flex flex-col items-center text-center">
                                    <CheckCircle2 className="w-12 h-12 mb-4" />
                                    <h3 className="font-bold text-lg mb-2">Request Queued</h3>
                                    <p className="text-sm opacity-80">We've added this to the ingestion pipeline. We will email you the moment their profile goes live on the network.</p>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="mt-6 border border-success px-6 py-2 text-xs font-bold uppercase tracking-widest hover:bg-success hover:text-success-foreground transition-colors">
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {submitError && (
                                        <div className="p-3 text-xs font-bold bg-destructive/10 text-destructive border border-destructive">
                                            {submitError}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Official's Name *</label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                            className="w-full border border-border p-3 focus:border-accent focus:outline-none bg-muted/20"
                                            placeholder="e.g. Bernie Sanders"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Your Email Address *</label>
                                        <input
                                            type="email"
                                            value={formEmail}
                                            onChange={(e) => setFormEmail(e.target.value)}
                                            required
                                            className="w-full border border-border p-3 focus:border-accent focus:outline-none bg-muted/20"
                                            placeholder="you@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Reference Link (Optional)</label>
                                        <input
                                            type="url"
                                            value={formLink}
                                            onChange={(e) => setFormLink(e.target.value)}
                                            className="w-full border border-border p-3 focus:border-accent focus:outline-none bg-muted/20"
                                            placeholder="Wikipedia or Campaign Site"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <p className="text-xs text-muted-foreground italic border-l-2 border-accent pl-3 mb-6">
                                            By submitting, you subscribe to The Daily Borg to receive the automated notification once the verification completes.
                                        </p>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-foreground text-background font-bold text-sm uppercase tracking-widest py-4 hover:bg-accent transition-colors disabled:opacity-50">
                                            {isSubmitting ? "Queueing Request..." : "Initialize Verification"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Click-away handler for dropdowns */}
            {(showSortDropdown || showStateDropdown) && (
                <div className="fixed inset-0 z-30" onClick={() => { setShowSortDropdown(false); setShowStateDropdown(false); }} />
            )}
        </>
    );
}
