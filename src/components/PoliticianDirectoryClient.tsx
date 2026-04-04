"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, X, AlertCircle, CheckCircle2 } from "lucide-react";
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
    consistency_label: string;
};

export function PoliticianDirectoryClient({ initialPoliticians }: { initialPoliticians: Politician[] }) {
    const [query, setQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formLink, setFormLink] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const filtered = initialPoliticians.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.district_state.toLowerCase().includes(query.toLowerCase()) ||
        p.office_held.toLowerCase().includes(query.toLowerCase())
    );

    const federalMatched = filtered.filter(p => p.region_level === 'Federal');
    const stateMatched = filtered.filter(p => p.region_level === 'State');
    const localMatched = filtered.filter(p => p.region_level === 'Local');

    const renderPoliticianCard = (pol: Politician) => (
        <Link key={pol.id} href={`/borg-record/politicians/${pol.slug}`} className="col-span-1 md:col-span-2 lg:col-span-3 border border-border group hover:border-accent transition-colors block">
            <div className={`aspect-[3/4] relative ${!pol.photo_url ? 'bg-muted' : 'bg-black'}`}>
                {pol.photo_url && (
                    <img src={pol.photo_url} alt={pol.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent flex flex-col justify-end p-4">
                    <span className={`text-xs font-bold uppercase tracking-widest w-fit px-2 py-1 mb-2 ${pol.party === 'Democrat' ? 'bg-blue-500/10 text-blue-500' : pol.party === 'Republican' ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>{pol.party}</span>
                    <h3 className="font-serif text-2xl font-bold leading-tight group-hover:text-accent transition-colors relative z-10">{pol.name}</h3>
                    <p className="text-sm font-medium text-muted-foreground mt-1 uppercase tracking-wider relative z-10">{pol.office_held} • {pol.district_state}</p>
                </div>
            </div>
            <div className="p-4 bg-background border-t border-border flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                <span className="text-muted-foreground">Detailed Record</span>
                <span className="text-foreground group-hover:text-accent transition-colors flex items-center">View <ChevronRight className="w-4 h-4 ml-1" /></span>
            </div>
        </Link>
    );

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
                    The public record, standardized and documented. Search for federal officials, track campaign promises, review their verified voting records, and measure their consistency over time.
                </p>
                <div className="mt-8 flex max-w-md items-center border-b-2 border-foreground group focus-within:border-accent transition-colors">
                    <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-accent" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search officials by name or state..."
                        className="w-full bg-transparent border-none outline-none p-3 text-lg font-medium placeholder:font-normal placeholder:text-muted-foreground"
                    />
                </div>
            </div>

            <div className="border-t-4 border-foreground pt-4 mb-8 flex justify-between items-end mt-16">
                <h2 className="font-serif text-3xl font-bold uppercase tracking-tight">Active Profiles</h2>
            </div>

            {filtered.length > 0 ? (
                <div className="space-y-16">
                    {federalMatched.length > 0 && (
                        <section>
                            <h3 className="font-serif text-2xl font-black uppercase tracking-widest border-b-[3px] border-border pb-2 mb-6">Federal</h3>
                            <NewsGrid>
                                {federalMatched.map(renderPoliticianCard)}
                            </NewsGrid>
                        </section>
                    )}
                    
                    {stateMatched.length > 0 && (
                        <section>
                            <h3 className="font-serif text-2xl font-black uppercase tracking-widest border-b-[3px] border-border pb-2 mb-6">State</h3>
                            <NewsGrid>
                                {stateMatched.map(renderPoliticianCard)}
                            </NewsGrid>
                        </section>
                    )}

                    {localMatched.length > 0 && (
                        <section>
                            <h3 className="font-serif text-2xl font-black uppercase tracking-widest border-b-[3px] border-border pb-2 mb-6">Local</h3>
                            <NewsGrid>
                                {localMatched.map(renderPoliticianCard)}
                            </NewsGrid>
                        </section>
                    )}
                </div>
            ) : (
                <div className="p-12 border-2 border-dashed border-border bg-muted/10 text-center flex flex-col items-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="font-serif text-3xl font-bold mb-4">No Officials Found</h3>
                    <p className="text-lg text-muted-foreground max-w-xl mb-8">
                        The Borg Record is actively expanding its intelligence matrix, but we couldn't find a match for "{query}".
                    </p>
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
        </>
    );
}
