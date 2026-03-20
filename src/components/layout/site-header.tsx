"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Search, User, Menu, Activity, Landmark, Building, Trophy } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface LiveUpdate {
    icon: any;
    text: string;
    time: string;
}

interface SiteHeaderProps {
    headlines?: string[];
    liveUpdates?: LiveUpdate[];
}

export function SiteHeader({ 
    headlines = [
        "DAILY BORG: Algorithmic news matrix active",
        "STATUS: Establishing connection to the grid...",
        "UPDATE: Autonomous feeders deployed and scouting"
    ],
    liveUpdates = [
        { icon: Activity, text: "Grid Status: Operational", time: "LIVE" },
        { icon: Landmark, text: "Public Record Sync: Complete", time: "NOW" }
    ]
}: SiteHeaderProps) {
    const [liveIndex, setLiveIndex] = useState(0);

    // Dynamic live updates are typically passed as sets, but for simplicity we can just slice them
    const liveUpdateSets = [
        liveUpdates.slice(0, 4),
        liveUpdates.slice(4, 8)
    ].filter(set => set.length > 0);

    // Duplicate for seamless scroll
    const tickerHeadlines = [...headlines, ...headlines];

    useEffect(() => {
        if (liveUpdateSets.length <= 1) return;
        const timer = setInterval(() => {
            setLiveIndex((prev) => (prev + 1) % liveUpdateSets.length);
        }, 12000); 
        return () => clearInterval(timer);
    }, [liveUpdateSets.length]);

    const currentDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    }).toUpperCase();

    return (
        <header className="flex flex-col w-full z-50">

            {/* 1. Breaking News Ticker (Red Bar) - Edge to Edge */}
            <div className="bg-destructive text-destructive-foreground flex items-center text-[11px] sm:text-xs font-medium tracking-wide w-full hidden sm:flex">
                {/* Label Area */}
                <div className="flex items-center gap-2 px-5 py-1.5 border-r border-red-800 whitespace-nowrap bg-red-700 font-sans shadow-md z-10 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-widest">Breaking</span>
                </div>
                {/* Scrolling Headlines */}
                <div className="overflow-hidden whitespace-nowrap px-4 py-1.5 flex-1 font-sans flex items-center relative">
                    <div className="ticker-animate flex gap-12 items-center min-w-max">
                        {tickerHeadlines.map((headline, idx) => (
                            <span key={idx} className="opacity-90">{headline}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Header Block container */}
            <div className="bg-[#fcfbfc] dark:bg-background sticky top-0 z-40 w-full font-sans">

                {/* 2. Date Bar (Navy Bar) - Edge to Edge, narrower */}
                <div className="bg-primary text-primary-foreground w-full flex justify-between items-center px-6 h-8 text-xs font-sans uppercase tracking-wide">
                    <span className="opacity-80">{currentDate}</span>
                    <div className="hidden sm:flex items-center gap-5 opacity-80">
                        <span className="cursor-pointer hover:opacity-100 transition-opacity">Morning Grid Edition v2</span>
                        <span className="cursor-pointer hover:underline transition-opacity">Admin</span>
                        <ThemeToggle />
                    </div>
                </div>

                {/* 3. Masthead Bar ("The Daily Borg") - CENTER ALIGNED */}
                <div className="w-full">
                    <div className="flex items-center justify-between py-6 px-6 max-w-[1400px] mx-auto w-full relative">

                        {/* Left Space to balance layout */}
                        <div className="hidden md:flex flex-1"></div>

                        {/* Logo area - Center Aligned */}
                        <div className="flex flex-col items-center text-center shrink-0 w-full md:w-auto">
                            <Link href="/" className="font-[family-name:var(--font-playfair)] text-4xl md:text-6xl font-black text-foreground tracking-tight leading-none hover:opacity-90 transition-opacity">
                                The Daily Borg
                            </Link>
                            <span className="font-[family-name:var(--font-source-sans)] text-[9px] sm:text-[10px] md:text-xs text-muted-foreground uppercase tracking-[0.25em] md:tracking-[0.3em] mt-2 delay-150">
                                Broadcast Operations & Reporting Grid
                            </span>
                        </div>

                        {/* Right Utilities */}
                        <div className="hidden md:flex flex-1 items-center justify-end gap-6 shrink-0">
                            <button aria-label="Search" className="text-foreground/80 hover:text-foreground transition-colors">
                                <Search className="w-5 h-5" />
                            </button>
                            <button aria-label="Account" className="text-foreground/80 hover:text-foreground transition-colors">
                                <User className="w-5 h-5" />
                            </button>
                            <Link href="/subscribe" className="bg-[#1a2b4c] dark:bg-primary text-white text-[10px] font-bold tracking-[0.1em] uppercase px-5 py-2.5 rounded shadow-sm hover:bg-[#0f1c3a] transition-colors ml-2">
                                Subscribe
                            </Link>
                        </div>

                        {/* Mobile Menu */}
                        <div className="md:hidden absolute right-6 top-1/2 -translate-y-1/2">
                            <button className="text-foreground p-2">
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. Navigation Bar - Bold Borders */}
                <div className="hidden md:flex border-b border-border bg-background w-full">
                    <nav className="flex justify-center items-center w-full max-w-[1400px] mx-auto overflow-x-auto no-scrollbar gap-0">
                        {["Politics", "Crime", "Business", "Entertainment", "Sports", "Science", "Education"].map((desk) => (
                            <Link
                                key={desk}
                                href={`/${desk.toLowerCase()}`}
                                className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground/70 hover:text-foreground transition-colors px-4 py-2.5 whitespace-nowrap flex-shrink-0"
                            >
                                {desk}
                            </Link>
                        ))}

                        {/* Partition */}
                        <div className="w-px h-5 bg-border mx-1 flex-shrink-0"></div>

                        <Link
                            href="/borg-record"
                            className="font-sans text-xs font-bold uppercase tracking-wider text-desk-borg hover:text-desk-borg/90 transition-colors px-4 py-2.5 whitespace-nowrap flex-shrink-0"
                        >
                            Borg Record
                        </Link>
                    </nav>
                </div>

                {/* 5. Live Strip */}
                <div className="bg-primary w-full font-sans overflow-hidden">
                    <div className="flex items-center w-full max-w-[1400px] mx-auto px-4 md:px-6 py-3">
                        <div className="flex flex-shrink-0 items-center gap-2 text-accent font-bold uppercase tracking-wider text-xs whitespace-nowrap">
                            <Activity className="w-3.5 h-3.5 animate-sparkline" />
                            <span>Live</span>
                        </div>

                        {/* Partition after LIVE */}
                        <div className="w-px h-4 bg-primary-foreground/20 ml-4 mr-4 flex-shrink-0"></div>

                        <div className="flex flex-1 overflow-hidden relative items-center min-h-[20px]">
                            {liveUpdateSets.map((set, setIndex) => {
                                const isActive = setIndex === liveIndex;

                                return (
                                    <div
                                        key={setIndex}
                                        className={`absolute inset-0 flex items-center gap-4 w-max transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                                    >
                                        {set.map((update, index) => {
                                            const Icon = update.icon;

                                            return (
                                                <React.Fragment key={index}>
                                                    <div className="flex items-center gap-2 flex-shrink-0 font-sans text-xs text-primary-foreground/80 hover:text-primary-foreground cursor-pointer transition-colors">
                                                        <Icon className="w-3.5 h-3.5 text-primary-foreground" />
                                                        <span>{update.text}</span>
                                                        <span className="text-[10px] text-primary-foreground/60 ml-1">{update.time}</span>
                                                    </div>

                                                    {/* Render divider for all items EXCEPT the last one */}
                                                    {index < set.length - 1 && (
                                                        <div className="w-px h-3 bg-primary-foreground/20 ml-2 flex-shrink-0"></div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        </header>
    );
}
