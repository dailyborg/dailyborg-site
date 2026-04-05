"use client";

import React, { useState, useEffect } from "react";
import { Activity, Radio, Zap, Globe, ShieldAlert, Users, BarChart3, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils";

interface LiveUpdate {
    icon: any;
    text: string;
    time: string;
    href: string;
}

interface DynamicLiveStripProps {
    isAdmin?: boolean;
}

const FALLBACK_UPDATES: LiveUpdate[] = [
    { icon: Activity, text: "Grid Status: Operational", time: "LIVE", href: "" },
    { icon: Globe, text: "Public Record Sync: Complete", time: "NOW", href: "" },
    { icon: ShieldAlert, text: "Borg Security: Green", time: "SECURE", href: "" },
    { icon: Radio, text: "Autonomous Feeders: Scouting", time: "ACTIVE", href: "" }
];

export function DynamicLiveStrip({ isAdmin = false }: DynamicLiveStripProps) {
    const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>(FALLBACK_UPDATES);
    const [adminUpdates, setAdminUpdates] = useState<LiveUpdate[]>([]);
    const [liveIndex, setLiveIndex] = useState(0);

    // Fetch public headlines for non-admin
    useEffect(() => {
        if (isAdmin) return;
        
        async function fetchLiveIntelligence() {
            try {
                const res = await fetch(`/api/headlines?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json() as { title: string; slug: string; desk: string }[];
                    const icons = [Activity, Zap, Globe, Radio];
                    const updates = data.map((item: any, i) => ({
                        icon: icons[i % icons.length],
                        text: item.title.length > 55 ? item.title.substring(0, 55) + "..." : item.title,
                        time: formatTimeAgo(item.publish_date),
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
    }, [isAdmin]);

    // Fetch admin metrics for admin mode
    useEffect(() => {
        if (!isAdmin) return;
        const token = localStorage.getItem("borg_admin_token");
        if (!token) return;

        async function fetchAdminMetrics() {
            try {
                const res = await fetch("/api/admin/metrics?days=7", {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json() as any;
                    const updates: LiveUpdate[] = [
                        { icon: Users, text: `Visitors Today: ${data.uniqueVisitorsToday}`, time: "NOW", href: "/admin?tab=analytics" },
                        { icon: TrendingUp, text: `Visitors This Week: ${(data.chartData || []).reduce((a: number, b: any) => a + b.visitors, 0)}`, time: "7D", href: "/admin?tab=analytics" },
                        { icon: FileText, text: `Published Today: ${data.successfulInsertsToday}`, time: "TODAY", href: "/admin?tab=queue" },
                        { icon: ShieldAlert, text: `Duplicates Caught: ${data.duplicatesCaughtToday}`, time: "TODAY", href: "/admin?tab=health" },
                        { icon: BarChart3, text: `Total Subscribers: ${data.totalSubscribers}`, time: "TOTAL", href: "/admin?tab=audience" },
                        { icon: Zap, text: `Paying Subscribers: ${data.payingSubscribers}`, time: "PAID", href: "/admin?tab=audience" },
                    ];
                    setAdminUpdates(updates);
                }
            } catch (err) {
                console.error("Failed to fetch admin metrics for strip:", err);
            }
        }

        fetchAdminMetrics();
        const interval = setInterval(fetchAdminMetrics, 30 * 1000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [isAdmin]);

    const displayUpdates = isAdmin ? (adminUpdates.length > 0 ? adminUpdates : FALLBACK_UPDATES) : liveUpdates;

    // Create chunks of 3 updates per view for denser ticker
    const liveUpdateSets = [];
    for (let i = 0; i < displayUpdates.length; i += 3) {
        liveUpdateSets.push(displayUpdates.slice(i, i + 3));
    }

    useEffect(() => {
        if (liveUpdateSets.length <= 1) return;
        const timer = setInterval(() => {
            setLiveIndex((prev) => (prev + 1) % liveUpdateSets.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [liveUpdateSets.length]);

    return (
        <div className={`${isAdmin ? 'bg-slate-800' : 'bg-primary'} w-full font-sans overflow-hidden`}>
            <div className="flex items-center w-full max-w-[1400px] mx-auto px-4 md:px-6 py-3">
                <div className={`flex flex-shrink-0 items-center gap-2 ${isAdmin ? 'text-amber-400' : 'text-accent'} font-bold uppercase tracking-wider text-xs whitespace-nowrap`}>
                    <Activity className="w-3.5 h-3.5 animate-sparkline" />
                    <span>{isAdmin ? 'Admin' : 'Live'}</span>
                </div>

                <div className={`w-px h-4 ${isAdmin ? 'bg-slate-600' : 'bg-primary-foreground/20'} ml-4 mr-4 flex-shrink-0`}></div>

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
                                        <div className={`flex items-center gap-2 flex-shrink-0 font-sans text-xs ${isAdmin ? 'text-slate-300' : 'text-primary-foreground/80'} ${update.href ? `hover:${isAdmin ? 'text-white' : 'text-primary-foreground'} cursor-pointer` : 'cursor-default'} transition-colors`}>
                                            <Icon className={`w-3.5 h-3.5 ${isAdmin ? 'text-slate-400' : 'text-primary-foreground'}`} />
                                            <span className="truncate max-w-[200px] md:max-w-[400px]">{update.text}</span>
                                            <span className={`text-[10px] ${isAdmin ? 'text-amber-400' : 'text-accent'} font-bold ml-1 tracking-wider`}>{update.time}</span>
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
                                                <div className={`w-px h-3 ${isAdmin ? 'bg-slate-600' : 'bg-primary-foreground/20'} ml-2 md:ml-4 flex-shrink-0`}></div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    }) : (
                        <div className={`text-xs ${isAdmin ? 'text-slate-500' : 'text-primary-foreground/50'} animate-pulse`}>Establishing uplink...</div>
                    )}
                </div>
            </div>
        </div>
    );
}
