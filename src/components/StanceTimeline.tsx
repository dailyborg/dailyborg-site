'use client';

import React from 'react';

export interface StanceChange {
    id: string;
    topic: string;
    shift_description: string;
    old_claim: {
        content: string;
        date: string;
        context: string;
    };
    new_claim: {
        content: string;
        date: string;
        context: string;
    };
    dateOfChange: string; // The date of the 'new_claim'
}

interface StanceTimelineProps {
    politicianName: string;
    stanceChanges: StanceChange[];
}

export default function StanceTimeline({ politicianName, stanceChanges }: StanceTimelineProps) {

    if (!stanceChanges || stanceChanges.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 text-center">
                <h3 className="text-xl font-semibold mb-2">Policy Evolution</h3>
                <p className="text-gray-500 italic">No major policy shifts or contradictions found for {politicianName} yet.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 mt-8">

            <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Stance Evolution Explorer
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Tracking how `{politicianName}`'s positions have shifted over time, including before and after taking office.
                </p>
            </div>

            <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 md:ml-6 space-y-12">
                {stanceChanges.map((change, index) => (
                    <div key={change.id} className="relative pl-6 md:pl-8">

                        {/* Timeline Dot */}
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-orange-500 border-4 border-white dark:border-gray-900"></div>

                        {/* Content Card */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border shadow-sm">

                            <div className="flex justify-between items-center mb-4">
                                <span className="font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide text-sm">
                                    {change.topic}
                                </span>
                                <span className="text-xs font-mono text-gray-500">{change.dateOfChange}</span>
                            </div>

                            <p className="text-gray-800 dark:text-gray-200 font-medium mb-4 text-sm md:text-base border-l-4 border-orange-400 pl-3">
                                {change.shift_description}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">

                                {/* Older Claim */}
                                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <span className="text-xs uppercase font-bold text-gray-400 block mb-2">Previous Stance ({change.old_claim.date})</span>
                                    <p className="text-sm italic text-gray-600 dark:text-gray-400">
                                        &quot;{change.old_claim.content}&quot;
                                    </p>
                                    <span className="text-xs text-gray-400 mt-2 block">- {change.old_claim.context}</span>
                                </div>

                                {/* Newer Claim */}
                                <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange-100 to-transparent dark:from-orange-900/30 rounded-bl-full opacity-50"></div>
                                    <span className="text-xs uppercase font-bold text-orange-500 block mb-2">New Stance ({change.new_claim.date})</span>
                                    <p className="text-sm italic text-gray-800 dark:text-gray-200">
                                        &quot;{change.new_claim.content}&quot;
                                    </p>
                                    <span className="text-xs text-gray-500 mt-2 block">- {change.new_claim.context}</span>
                                </div>

                            </div>

                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}
