"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Flame, ShieldAlert, XCircle, Search } from 'lucide-react';
import Link from 'next/link';

export function LiarLiarClient() {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [factChecks, setFactChecks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

    // Filters
    const [partyFilter, setPartyFilter] = useState('all');
    const [stateFilter, setStateFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => {
        fetchLeaderboard();
    }, [partyFilter, stateFilter, roleFilter]);

    useEffect(() => {
        if (selectedSlug) {
            fetchFactChecks(selectedSlug);
        }
    }, [selectedSlug]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (partyFilter !== 'all') params.append('party', partyFilter);
            if (stateFilter !== 'all') params.append('state', stateFilter);
            if (roleFilter !== 'all') params.append('role', roleFilter);

            const res = await fetch(`/api/fact-checks?${params.toString()}`);
            const data = (await res.json()) as any;
            setLeaderboard(data.leaderboard || []);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const fetchFactChecks = async (slug: string) => {
        try {
            const res = await fetch(`/api/fact-checks?slug=${slug}`);
            const data = (await res.json()) as any;
            setFactChecks(data.fact_checks || []);
        } catch (e) {
            console.error(e);
        }
    };

    // Styling logic for the "Ignis Veritas" fiery gradient
    const getBarColor = (entry: any) => {
        const severity = entry.severe_lies / entry.total_lies;
        if (severity > 0.5) return "url(#pantsOnFire)"; // Fiery red
        return "url(#mostlyFalse)"; // Orange warning
    };

    return (
        <div className="min-h-screen bg-[#0c0e12] text-[#f6f6fc] font-inter">
            {/* TopAppBar Concept from Obsidian Lens */}
            <header className="sticky top-0 z-50 bg-[#111318]/80 backdrop-blur-md border-b border-[#46484d]/30 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Flame className="w-8 h-8 text-[#ff4d00]" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 77, 0, 0.5))' }} />
                    <h1 className="text-2xl font-bold font-space-grotesk tracking-tight text-[#f9f9ff]">
                        Liar Liar Pants on Fire
                    </h1>
                </div>
                <Link href="/borg-record" className="text-sm font-medium hover:text-[#ff906d] transition-colors">
                    &larr; Back to Borg Record
                </Link>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                
                {/* Dashboard Intro */}
                <div className="bg-[#171a1f] rounded-xl border border-[#46484d]/20 p-6 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff4d00]/5 blur-[100px] rounded-full pointer-events-none"></div>
                    <h2 className="text-xl font-bold font-space-grotesk text-white">The Accountability Index</h2>
                    <p className="text-[#aaabb0] mt-2 max-w-3xl">
                        This forensic terminal tracks objectively veriafiable false statements, promises, and claims made by public officials. 
                        Records are analyzed autonomously by the edge matrix. Data is not an opinion; it is a ledger.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-[#111318] p-4 rounded-xl border border-[#46484d]/20">
                    <div className="flex items-center space-x-2">
                        <Search className="w-4 h-4 text-[#74757a]" />
                        <span className="text-sm uppercase tracking-widest text-[#74757a] font-semibold">Triage Filters</span>
                    </div>

                    <select 
                        value={partyFilter} 
                        onChange={(e) => setPartyFilter(e.target.value)}
                        className="bg-[#23262c] text-[#f6f6fc] border border-[#46484d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff906d] transition-colors appearance-none"
                    >
                        <option value="all">Any Party</option>
                        <option value="Democrat">Democrat</option>
                        <option value="Republican">Republican</option>
                        <option value="Independent">Independent</option>
                    </select>

                    <select 
                        value={roleFilter} 
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-[#23262c] text-[#f6f6fc] border border-[#46484d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff906d] transition-colors appearance-none"
                    >
                        <option value="all">Any Office</option>
                        <option value="President">President</option>
                        <option value="Senate">Senate</option>
                        <option value="Representative">Representative</option>
                    </select>

                    <select 
                        value={stateFilter} 
                        onChange={(e) => setStateFilter(e.target.value)}
                        className="bg-[#23262c] text-[#f6f6fc] border border-[#46484d] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff906d] transition-colors appearance-none"
                    >
                        <option value="all">Any State</option>
                        <option value="NY">NY</option>
                        <option value="CA">CA</option>
                        <option value="TX">TX</option>
                        <option value="FL">FL</option>
                        {/* More states can be added dynamically */}
                    </select>
                </div>

                {/* Main Chart Section */}
                <div className="bg-[#171a1f] p-6 rounded-xl border border-[#46484d]/20 shadow-2xl relative">
                    <h3 className="text-lg font-space-grotesk font-bold text-white mb-6 uppercase tracking-wider">Dishonesty Rankings</h3>
                    
                    {loading ? (
                        <div className="h-96 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-[#ff4d00]/30 border-t-[#ff4d00] rounded-full animate-spin"></div>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="h-96 flex flex-col items-center justify-center text-[#aaabb0]">
                            <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
                            <p>No falsehoods recorded for the selected criteria.</p>
                        </div>
                    ) : (
                        <div className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={leaderboard} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pantsOnFire" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#ff4d00" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#ff0000" stopOpacity={1} />
                                        </linearGradient>
                                        <linearGradient id="mostlyFalse" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#fe8f00" stopOpacity={0.7} />
                                            <stop offset="100%" stopColor="#ff4d00" stopOpacity={0.9} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis type="number" stroke="#74757a" strokeWidth={0.5} />
                                    <YAxis dataKey="name" type="category" stroke="#aaabb0" tick={{fill: '#f6f6fc', fontSize: 13, fontFamily: 'Inter'}} width={120} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        cursor={{fill: '#23262c'}}
                                        contentStyle={{ backgroundColor: '#111318', border: '1px solid #46484d', borderRadius: '8px' }}
                                        itemStyle={{ color: '#f9f9ff' }}
                                    />
                                    <Bar dataKey="total_lies" radius={[0, 4, 4, 0]} onClick={(data: any) => setSelectedSlug(data.payload.slug)} className="cursor-pointer">
                                        {leaderboard.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getBarColor(entry)} className="hover:opacity-80 transition-opacity" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    <p className="text-xs text-[#74757a] mt-4 flex items-center"><Flame className="w-3 h-3 mr-1"/> Select a bar to view detailed falsehood records.</p>
                </div>

                {/* Specific Politician Focus */}
                {selectedSlug && (
                    <div className="space-y-6">
                        <div className="flex items-center space-x-2 pb-2 border-b border-[#fe8f00]/30">
                            <XCircle className="w-5 h-5 text-[#ff4d00]" />
                            <h3 className="text-xl font-space-grotesk font-bold text-white uppercase">Forensic Truth Log</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {factChecks.length === 0 ? (
                                <p className="text-[#aaabb0] py-4">Fetching records...</p>
                            ) : factChecks.map((fc: any) => (
                                <div key={fc.id} className="bg-[#1d2025] rounded-xl p-5 border border-[#46484d]/30 hover:border-[#ff4d00]/50 transition-all group shadow-lg relative overflow-hidden">
                                    {fc.rating === 'pants_on_fire' && (
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff0000]/10 blur-[50px] pointer-events-none group-hover:bg-[#ff0000]/20 transition-all"></div>
                                    )}
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md ${fc.rating === 'pants_on_fire' ? 'bg-[#490006] text-[#ffa8a3] border border-[#9f0519]' : 'bg-[#462400] text-[#ffc697] border border-[#ea8400]'}`}>
                                            {fc.rating === 'pants_on_fire' ? 'Pants on Fire!' : 'Falsehood'}
                                        </span>
                                        <span className="text-xs text-[#74757a]">{fc.date}</span>
                                    </div>
                                    
                                    <blockquote className="text-white font-medium text-lg leading-snug mb-4 border-l-2 border-[#ff4d00] pl-4">
                                        "{fc.statement}"
                                    </blockquote>
                                    
                                    <div className="bg-[#111318] p-3 rounded-lg border border-[#46484d]/30">
                                        <p className="text-xs uppercase text-[#81ecff] font-semibold mb-1 tracking-wider">AI Audit Analysis</p>
                                        <p className="text-sm text-[#aaabb0]">{fc.analysis_text}</p>
                                    </div>

                                    {fc.source_url && (
                                        <div className="mt-4">
                                            <a href={fc.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#ff906d] hover:text-[#ffc697] transition-colors uppercase font-semibold">
                                                Verify Source Document &rarr;
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
