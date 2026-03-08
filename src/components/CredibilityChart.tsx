'use client';

import React, { useState } from 'react';

// Types mirroring our D1 schema
export interface Claim {
    id: string;
    type: 'Fact' | 'Promise' | 'Opinion';
    content: string;
    date: string;
    context: string;
}

export interface Evidence {
    id: string;
    claim_id: string;
    url: string;
    archive_url?: string;
    source_name: string;
    trust_score: number;
}

interface CredibilityChartProps {
    politicianName: string;
    claims: Claim[];
    evidenceMap: Record<string, Evidence[]>; // Keyed by claim id
}

export default function CredibilityChart({ politicianName, claims, evidenceMap }: CredibilityChartProps) {
    const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

    // Simple stats calculation
    const totalClaims = claims.length;
    const promises = claims.filter(c => c.type === 'Promise');
    const facts = claims.filter(c => c.type === 'Fact');

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800">

            {/* Header Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Accountability Engine
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Real-time verification of `{politicianName}`'s public statements.
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <span className="block text-2xl font-bold text-blue-600 dark:text-blue-400">{promises.length}</span>
                        <span className="text-xs text-blue-800 dark:text-blue-300 uppercase tracking-wider font-semibold">Promises</span>
                    </div>
                    <div className="text-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                        <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">{facts.length}</span>
                        <span className="text-xs text-emerald-800 dark:text-emerald-300 uppercase tracking-wider font-semibold">Facts Checked</span>
                    </div>
                </div>
            </div>

            {/* The Timeline / List View */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Recent Public Record</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {claims.map((claim) => (
                        <div
                            key={claim.id}
                            onClick={() => setSelectedClaim(claim)}
                            className="p-4 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-800"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${claim.type === 'Promise' ? 'bg-purple-100 text-purple-700' :
                                    claim.type === 'Fact' ? 'bg-teal-100 text-teal-700' :
                                        'bg-gray-200 text-gray-700'
                                    }`}>
                                    {claim.type}
                                </span>
                                <span className="text-xs text-gray-500">{claim.date}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-3">
                                &quot;{claim.content}&quot;
                            </p>
                            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                {claim.context}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Verification Modal / Slide-out Panel */}
            {selectedClaim && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden">

                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedClaim(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>

                        <div className="mb-6">
                            <span className="text-sm font-bold text-blue-600 uppercase tracking-wider">{selectedClaim.type} Analysis</span>
                            <h3 className="text-xl font-medium mt-2 italic text-gray-800 dark:text-gray-200">
                                &quot;{selectedClaim.content}&quot;
                            </h3>
                            <p className="text-sm text-gray-500 mt-2">Said on {selectedClaim.date} at {selectedClaim.context}</p>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Verification Sources</h4>

                            {evidenceMap[selectedClaim.id] && evidenceMap[selectedClaim.id].length > 0 ? (
                                <ul className="space-y-3">
                                    {evidenceMap[selectedClaim.id].map(evidence => (
                                        <li key={evidence.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${evidence.trust_score > 80 ? 'bg-green-500' : evidence.trust_score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                                <span className="font-medium text-sm">{evidence.source_name}</span>
                                            </div>
                                            <div className="mt-2 sm:mt-0 flex gap-2">
                                                <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View Source &rarr;</a>
                                                {evidence.archive_url && (
                                                    <a href={evidence.archive_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:underline">View Archive (Permanent)</a>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No verification sources have been mapped to this claim yet.</p>
                            )}
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
