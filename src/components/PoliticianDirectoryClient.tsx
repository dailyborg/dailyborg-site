"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, X, AlertCircle, CheckCircle2, ChevronDown, Award, MapPin, Loader2 } from "lucide-react";
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
    promises_total?: number;
    popularity_score?: number;
    candidate_status?: string;
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

function PoliticianCard({ pol }: { pol: Politician }) {
    const trust = getTrustBadge(pol.trustworthiness_score);
    const [imgSrc, setImgSrc] = useState(pol.photo_url || null);
    const [imgFailed, setImgFailed] = useState(false);

    // Self-healing Wikipedia Photo Fetcher
    useEffect(() => {
        if (!imgSrc || imgFailed) {
            const fetchWikiImage = async () => {
                try {
                    const wikiTitle = encodeURIComponent(pol.name.trim().replace(/ /g, '_'));
                    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`);
                    if (res.ok) {
                        const data = await res.json() as any;
                        if (data && data.thumbnail && data.thumbnail.source) {
                            setImgSrc(data.thumbnail.source);
                            setImgFailed(false);
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Wikipedia Image Fetch Error:", e);
                }
                setImgFailed(true);
            };
            fetchWikiImage();
        }
    }, [pol.name, imgSrc, imgFailed]);

    // Premium Fallback Initials
    const initials = pol.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
        <Link key={pol.id} href={`/borg-record/politicians/${pol.slug}`} className="col-span-1 md:col-span-2 lg:col-span-3 bg-background border border-border group hover:border-accent hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] duration-500 transition-all block relative overflow-hidden rounded-sm">
            <div className="aspect-[4/5] relative bg-muted/20 overflow-hidden">
                {imgSrc && !imgFailed ? (
                    <img 
                        src={imgSrc} 
                        alt={pol.name} 
                        onError={() => setImgFailed(true)}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 transition-colors">
                        <span className="font-serif text-6xl text-foreground/20 font-black tracking-tighter">
                            {initials}
                        </span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent flex flex-col justify-end p-6">
                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] w-fit px-2.5 py-1 mb-3 border backdrop-blur-sm shadow-sm ${trust.color}`}>
                        {trust.icon} {trust.label}
                    </div>
                    {(pol.candidate_status === 'Candidate' || pol.candidate_status === 'Former') && (
                        <div className={`text-[9px] font-black uppercase tracking-[0.2em] w-fit px-2.5 py-1 mb-3 border backdrop-blur-sm shadow-sm ${pol.candidate_status === 'Former' ? 'bg-red-500/80 text-white border-red-500/30' : 'bg-accent/80 text-white border-accent/30'}`}>
                            {pol.candidate_status === 'Former' ? '★ Historical Archive' : '★ Upcoming Candidate'}
                        </div>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-widest w-fit px-2.5 py-1 mb-2 shadow-sm rounded-sm backdrop-blur-md ${pol.party === 'Democrat' ? 'bg-blue-500/80 text-white' : pol.party === 'Republican' ? 'bg-red-500/80 text-white' : 'bg-foreground/80 text-background'}`}>
                        {pol.party}
                    </span>
                    <h3 className="font-serif text-3xl font-bold leading-none mt-2 group-hover:text-accent transition-colors drop-shadow-sm">{pol.name}</h3>
                    <p className="text-xs font-semibold text-muted-foreground mt-2 uppercase tracking-widest drop-shadow-sm">{pol.office_held} <span className="opacity-50 mx-1">•</span> {pol.district_state}</p>
                </div>
            </div>
            
            <div className="px-6 py-4 bg-background flex justify-between items-center text-xs font-bold uppercase tracking-wider relative z-20">
                <div className="flex items-center gap-3">
                    {pol.promises_total && pol.promises_total > 0 ? (
                        <span className="text-foreground/70 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-accent" />
                            {pol.promises_kept}/{pol.promises_total} Promises Kept
                        </span>
                    ) : (
                        <span className="text-foreground/50">Detailed Record</span>
                    )}
                </div>
                <span className="text-muted-foreground group-hover:text-accent transition-colors flex items-center text-[10px] tracking-[0.2em]">View File <ChevronRight className="w-3.5 h-3.5 ml-1" /></span>
            </div>
        </Link>
    );
}

export function PoliticianDirectoryClient({ initialPoliticians, initialState }: { initialPoliticians: Politician[], initialState?: string | null }) {
    const validInitialState = initialState && US_STATES.includes(initialState) ? initialState : null;
    const router = useRouter();
    
    // Core search
    const [query, setQuery] = useState("");
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [pinnedIds, setPinnedIds] = useState<string[]>([]);

    useEffect(() => {
        const loadPinned = () => {
            try {
                const saved = localStorage.getItem('tracked_politicians');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setPinnedIds(parsed.filter((p: any) => p.pinned === true).map((p: any) => p.id));
                }
            } catch(e) {}
        };
        loadPinned();
        window.addEventListener('borg_tracked_officials_update', loadPinned);
        return () => window.removeEventListener('borg_tracked_officials_update', loadPinned);
    }, []);

    // Filters (Default to State auto-selected using Geo IP)
    const [levelFilter, setLevelFilter] = useState<string | null>(validInitialState ? 'State' : null);
    const [partyFilter, setPartyFilter] = useState<string | null>(null);
    const [stateFilter, setStateFilter] = useState<string | null>(validInitialState);
    const [localTownFilter, setLocalTownFilter] = useState<string>("");
    const [showHistorical, setShowHistorical] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');

    // Form state
    const [formName, setFormName] = useState("");
    const [formLink, setFormLink] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    // Civic Engine State
    const [civicQuery, setCivicQuery] = useState("");
    const [isSearchingCivic, setIsSearchingCivic] = useState(false);
    const [civicResultCount, setCivicResultCount] = useState<number | null>(null);

    const handleCivicSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!civicQuery.trim()) return;
        setIsSearchingCivic(true);
        setCivicResultCount(null);
        try {
            const res = await fetch('/api/civic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: civicQuery })
            });
            const data: any = await res.json();
            if (data.success) {
                // If the engine ingested new politicians, we must reload the Server component via router!
                setCivicResultCount(data.ingestedCount);
                if (data.ingestedCount > 0) {
                    router.refresh();
                } else if (data.officialsFound > 0) {
                     setCivicResultCount(0); // already had them
                }
            }
        } catch(e) {
            console.error("Civic engine lookup failed", e);
        } finally {
            setIsSearchingCivic(false);
        }
    };

    const activeFilterCount = [levelFilter, partyFilter, stateFilter, localTownFilter].filter(Boolean).length;

    const filteredAndSorted = useMemo(() => {
        let result = initialPoliticians.filter(p => {
            const q = query.toLowerCase();
            const matchesSearch = !q || 
                p.name.toLowerCase().includes(q) ||
                p.district_state.toLowerCase().includes(q) ||
                p.office_held.toLowerCase().includes(q) ||
                (STATE_NAMES[p.district_state.split('-')[0]]?.toLowerCase().includes(q));

            const matchesLevel = !levelFilter || p.region_level === levelFilter;
            const matchesParty = !partyFilter || p.party === partyFilter;
            const matchesState = !stateFilter || p.district_state.startsWith(stateFilter);
            const matchesTown = !localTownFilter || p.district_state.toLowerCase().includes(localTownFilter.toLowerCase());
            
            const isFormer = p.candidate_status === 'Former';
            const matchesHistorical = showHistorical ? true : !isFormer; // Hide former unless toggled

            return matchesSearch && matchesLevel && matchesParty && matchesState && matchesTown && matchesHistorical;
        });

        result.sort((a, b) => {
            // Priority: Pinned Officials completely outrank all existing sorts
            if (pinnedIds.length > 0) {
                const aPinned = pinnedIds.includes(a.id);
                const bPinned = pinnedIds.includes(b.id);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
            }

            switch (sortBy) {
                case 'name-asc': return a.name.localeCompare(b.name);
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'trustworthy': return (b.trustworthiness_score ?? -1) - (a.trustworthiness_score ?? -1);
                case 'promises': return (b.promises_kept ?? 0) - (a.promises_kept ?? 0);
                case 'popular': return (b.popularity_score ?? 0) - (a.popularity_score ?? 0);
                case 'newest': return b.id.localeCompare(a.id);
                default: return 0;
            }
        });

        return result;
    }, [initialPoliticians, query, levelFilter, partyFilter, stateFilter, localTownFilter, sortBy, pinnedIds]);

    const clearAllFilters = () => {
        setLevelFilter(null);
        setPartyFilter(null);
        setStateFilter(null);
        setLocalTownFilter("");
        setSortBy('name-asc');
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
        <div className="pb-24">
            {/* Header & Search Block */}
            <div className="max-w-3xl mb-12">
                <h1 className="font-serif text-5xl md:text-6xl font-black tracking-tight mb-6 leading-none">The Borg Record</h1>
                <p className="text-xl text-muted-foreground font-serif leading-relaxed mb-10 max-w-2xl">
                    The public record, rigorously standardized and documented. Explore intelligence files across precise levels of governance.
                </p>
                <div className="relative group max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent transition-colors" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search specific officials or jurisdictions..."
                        className="w-full bg-background border border-border outline-none pl-12 pr-4 py-4 text-base font-medium rounded-full shadow-sm hover:shadow-md focus:border-accent focus:shadow-md focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-muted-foreground/60"
                    />
                </div>
            </div>

            {/* ═══════════════════ REFINED PREMIUM TABS (Stitch Aesthetic) ═══════════════════ */}
            <div className="mb-10 w-full animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    {/* Outer Glass Container */}
                    <div className="inline-flex p-1.5 bg-muted/40 backdrop-blur-md rounded-full mb-0 border border-border/50 shadow-sm max-w-full overflow-x-auto scroolbar-hide">
                        {['Federal', 'State', 'Local'].map(level => {
                            const isActive = levelFilter === level;
                            return (
                                <button
                                    key={level}
                                    onClick={() => {
                                        if (isActive) {
                                            setLevelFilter(null);
                                        } else {
                                            setLevelFilter(level);
                                            if (level === 'Federal') {
                                               setStateFilter(null);
                                               setLocalTownFilter("");
                                            }
                                        }
                                    }}
                                    className={`px-8 py-3 rounded-full text-xs md:text-sm font-bold uppercase tracking-[0.15em] transition-all duration-300 relative ${isActive ? 'text-background shadow-md' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'}`}
                                >
                                    {isActive && (
                                        <span className="absolute inset-0 bg-foreground rounded-full -z-10 animate-in zoom-in-95 duration-200"></span>
                                    )}
                                    {level}
                                </button>
                            );
                        })}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mr-4 ml-2">
                        <input 
                            type="checkbox" 
                            checked={showHistorical} 
                            onChange={(e) => setShowHistorical(e.target.checked)}
                            className="accent-red-500 w-4 h-4 rounded-sm border-border"
                        />
                        Show Past Officials Database
                        {showHistorical && <AlertCircle className="w-3.5 h-3.5 text-red-500 inline ml-1" />}
                    </label>
                </div>

                {/* Smooth Expansion Dropdown Area */}
                <div className={`transition-all duration-500 origin-top overflow-hidden ${levelFilter === 'State' || levelFilter === 'Local' ? 'max-h-[200px] opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'}`}>
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 border border-border rounded-2xl p-6 backdrop-blur-sm">
                        <label className="font-serif text-lg font-bold text-muted-foreground whitespace-nowrap hidden md:block">
                            {levelFilter === 'Local' ? 'Focus Region :' : 'Focus State :'}
                        </label>
                        
                        <div className="relative w-full max-w-sm">
                            <select
                                value={stateFilter || ""}
                                onChange={(e) => setStateFilter(e.target.value || null)}
                                className="w-full appearance-none bg-background border border-border rounded-xl py-3 px-5 text-sm font-bold uppercase tracking-widest cursor-pointer shadow-sm hover:border-accent hover:shadow-md transition-all outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
                            >
                                <option value="">National Analysis (All States)</option>
                                {US_STATES.map(s => <option key={s} value={s}>{STATE_NAMES[s]} [{s}]</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>

                        {levelFilter === 'Local' && (
                            <div className="relative w-full max-w-sm">
                                <form onSubmit={handleCivicSearch} className="relative w-full">
                                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                                    <input 
                                        type="text" 
                                        placeholder="Exact Zip Code or Address..." 
                                        value={civicQuery} 
                                        onChange={(e) => setCivicQuery(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl py-3 pl-11 pr-24 text-sm font-bold uppercase tracking-widest placeholder:text-muted-foreground/40 shadow-sm hover:border-accent hover:shadow-md transition-all outline-none focus:border-accent focus:ring-4 focus:ring-accent/10" 
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={isSearchingCivic || !civicQuery.trim()}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-foreground text-background py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center"
                                    >
                                        {isSearchingCivic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "PING"}
                                    </button>
                                </form>
                                {civicResultCount !== null && (
                                    <p className="text-[10px] uppercase font-bold tracking-widest mt-3 text-accent text-center animate-in fade-in slide-in-from-top-1">
                                        {civicResultCount > 0 ? `Successfully Discovered ${civicResultCount} Local Officials. Displaying now.` : `All Local Officials already tracked in database.`}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════════ SECONDARY FILTERS & METADATA ═══════════════════ */}
            <div className="border-t border-border/50 pt-8 mb-8 flex flex-wrap justify-between items-center gap-6">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Party Filter Pills */}
                    <div className="flex items-center gap-2">
                        {['Democrat', 'Republican', 'Independent'].map(party => {
                            const isSelected = partyFilter === party;
                            return (
                                <button
                                    key={party}
                                    onClick={() => setPartyFilter(isSelected ? null : party)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border ${isSelected 
                                        ? party === 'Democrat' ? 'bg-blue-600/10 text-blue-600 border-blue-600/30' 
                                            : party === 'Republican' ? 'bg-red-600/10 text-red-600 border-red-600/30' 
                                            : 'bg-foreground/10 text-foreground border-foreground/30'
                                        : 'bg-transparent text-muted-foreground border-border hover:bg-muted'}`}
                                >
                                    {party}
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Filter Clearer */}
                    {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:bg-destructive/10 px-3 py-2 rounded-full transition-colors hidden sm:block">
                            Clear Filters ({activeFilterCount})
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {filteredAndSorted.length} Record{filteredAndSorted.length !== 1 ? 's' : ''} Indexed
                    </p>

                    {/* Sort Dropdown */}
                    <div className="relative z-30">
                        <button
                            onClick={() => setShowSortDropdown(!showSortDropdown)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border border-border hover:border-foreground transition-colors bg-background"
                        >
                            Sort: {SORT_LABELS[sortBy]}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showSortDropdown && (
                            <div className="absolute right-0 top-full mt-2 bg-background border border-border rounded-xl shadow-xl min-w-[220px] overflow-hidden">
                                {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
                                    <button
                                        key={key}
                                        onClick={() => { setSortBy(key); setShowSortDropdown(false); }}
                                        className={`w-full text-left px-5 py-3 text-xs font-bold uppercase tracking-widest hover:bg-muted/50 transition-colors flex items-center justify-between ${sortBy === key ? 'text-accent bg-accent/5' : 'text-foreground/80'}`}
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

            {/* ═══════════════════ RESULTS GRID ═══════════════════ */}
            {filteredAndSorted.length > 0 ? (
                <NewsGrid>
                    {filteredAndSorted.map(pol => <PoliticianCard key={pol.id} pol={pol} />)}
                </NewsGrid>
            ) : (
                <div className="py-24 border border-border rounded-3xl bg-muted/5 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                        <AlertCircle className="w-8 h-8 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="font-serif text-3xl font-bold mb-3 tracking-tight">No Records Found</h3>
                    <p className="text-base text-muted-foreground max-w-md mb-8">
                        {query ? `We couldn't locate any intelligence records matching "${query}".` : 'No officials match the exact parameters of your filters.'}
                    </p>
                    
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearAllFilters}
                            className="mb-8 border border-border px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-muted transition-colors"
                        >
                            Reset Parameters
                        </button>
                    )}
                    
                    <div className="w-full max-w-sm h-px bg-border my-6"></div>
                    
                    <button
                        onClick={() => {
                            setFormName(query);
                            setIsModalOpen(true);
                        }}
                        className="bg-foreground text-background font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        Request System Indexing
                    </button>
                </div>
            )}

            {/* Modal remains mostly unchanged structurally but visually refined */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-background border border-border rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/40 hover:bg-muted rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-10 md:p-12">
                            <h2 className="font-serif text-3xl font-bold mb-3 tracking-tight">Request System Indexing</h2>
                            <p className="text-sm text-muted-foreground mb-10 leading-relaxed max-w-md">Submit an official for automated intelligence indexing. Our verification nodes will autonomously compile their entire public footprint into our verified Trust Matrix.</p>

                            {submitSuccess ? (
                                <div className="p-8 bg-success/10 rounded-2xl border border-success/20 text-success flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-xl mb-2">Request Verified</h3>
                                    <p className="text-sm opacity-90 max-w-xs mb-8">This official has been placed securely into the indexing queue. You will be notified the moment their profile executes.</p>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="bg-success text-success-foreground px-8 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-all">
                                        Close Window
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {submitError && (
                                        <div className="p-4 text-xs font-bold bg-destructive/10 text-destructive rounded-xl text-center">
                                            {submitError}
                                        </div>
                                    )}
                                    <div className="space-y-5">
                                        <div>
                                            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-medium focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/10 outline-none transition-all" placeholder="Official's Exact Name *" />
                                        </div>
                                        <div>
                                            <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-medium focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/10 outline-none transition-all" placeholder="Your Secure Email Address *" />
                                        </div>
                                        <div>
                                            <input type="url" value={formLink} onChange={(e) => setFormLink(e.target.value)} className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-medium focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/10 outline-none transition-all" placeholder="Reference URL (Optional)" />
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full bg-foreground text-background font-bold text-xs uppercase tracking-widest py-4 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
                                            {isSubmitting ? "Queueing Protocol..." : "Initialize Engine"}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {(showSortDropdown) && (
                <div className="fixed inset-0 z-20" onClick={() => setShowSortDropdown(false)} />
            )}
        </div>
    );
}
