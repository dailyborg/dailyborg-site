"use client";

import React, { useState, useEffect } from "react";
import { Activity, Radio, Zap, Globe, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface LiveUpdate {
    icon: any;
    text: string;
    time: string;
    href: string;
}

const FALLBACK_UPDATES: LiveUpdate[] = [
    { icon: Activity, text: "Grid Status: Operational", time: "LIVE", href: "" },
    { icon: Globe, text: "Public Record Sync: Complete", time: "NOW", href: "" },
    { icon: ShieldAlert, text: "Borg Security: Green", time: "SECURE", href: "" },
    { icon: Radio, text: "Autonomous Feeders: Scouting", time: "ACTIVE", href: "" }
];

export function DynamicLiveStrip() {
    const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>(FALLBACK_UPDATES);
    const [liveIndex, setLiveIndex] = useState(0);

    useEffect(() => {
        async function fetchLiveIntelligence() {
            try {
                const res = await fetch("/api/headlines");
                if (res.ok) {
                    const data = await res.json() as { title: string; slug: string; desk: string }[];
                    const icons = [Activity, Zap, Globe, Radio];
                    const updates = data.map((item, i) => ({
                        icon: icons[i % icons.length],
                        text: item.title.length > 55 ? item.title.substring(0, 55) + "..." : item.title,
                        time: i === 0 ? "JUST IN" : `${i + 1}m AGO`,
                        href: item.slug ? `/${item.desk}/${item.slug}` : "",
                    }));
                    
                    if (updates.length > 0) {
                        setLiveUpdates(updates);
                    }
                }
            } catch (err) {
                console.error("Failed to pulse live updates:", err);
            }
        }

        fetchLiveIntelligence();
        const interval = setInterval(fetchLiveIntelligence, 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Create chunks of 3 updates per view for denser ticker
    const liveUpdateSets = [];
    for (let i = 0; i < liveUpdates.length; i += 3) {
        liveUpdateSets.push(liveUpdates.slice(i, i + 3));
    }

    useEffect(() => {
        if (liveUpdateSets.length <= 1) return;
        const timer = setInterval(() => {
            setLiveIndex((prev) => (prev + 1) % liveUpdateSets.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [liveUpdateSets.length]);

    return (
        <div className="bg-primary w-full font-sans overflow-hidden">
            <div className="flex items-center w-full max-w-[1400px] mx-auto px-4 md:px-6 py-3">
                <div className="flex flex-shrink-0 items-center gap-2 text-accent font-bold uppercase tracking-wider text-xs whitespace-nowrap">
                    <Activity className="w-3.5 h-3.5 animate-sparkline" />
                    <span>Live</span>
                </div>

                <div className="w-px h-4 bg-primary-foreground/20 ml-4 mr-4 flex-shrink-0"></div>

                <div className="flex flex-1 overflow-hidden relative items-center min-h-[20px]">
                    {liveUpdateSets.length > 0 ? liveUpdateSets.map((set, setIndex) => {
                        const isActive = setIndex === liveIndex;
                        return (
                            <div
                                key={setIndex}
                                className={`absolute inset-0 flex items-center gap-4 md:gap-8 w-max transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                            >
                                {set.map((update, index) => {
                                    const Icon = update.icon;
                                    const content = (
                                        <div className={`flex items-center gap-2 flex-shrink-0 font-sans text-xs text-primary-foreground/80 ${update.href ? 'hover:text-primary-foreground cursor-pointer' : 'cursor-default'} transition-colors`}>
                                            <Icon className="w-3.5 h-3.5 text-primary-foreground" />
                                            <span className="truncate max-w-[200px] md:max-w-[400px]">{update.text}</span>
                                            <span className="text-[10px] text-accent font-bold ml-1 tracking-wider">{update.time}</span>
                                        </div>
                                    );
                                    return (
                                        <React.Fragment key={index}>
                                            {update.href ? (
                                                <Link href={update.href}>{content}</Link>
                                            ) : (
                                                content
                                            )}
                                            {index < set.length - 1 && (
                                                <div className="w-px h-3 bg-primary-foreground/20 ml-2 md:ml-4 flex-shrink-0"></div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    }) : (
                        <div className="text-xs text-primary-foreground/50 animate-pulse">Establishing uplink...</div>
                    )}
                </div>
            </div>
        </div>
    );
}
