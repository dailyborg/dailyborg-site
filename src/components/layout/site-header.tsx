"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Menu, X, Activity, ShieldAlert, ShieldCheck, BarChart3, Users, FileText } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { DynamicTicker } from "./dynamic-ticker";
import { DynamicLiveStrip } from "./dynamic-live-strip";
import { usePathname, useSearchParams } from "next/navigation";
import { useAdminSession } from "@/hooks/useAdminSession";
import { currentEditionName } from "@/lib/utils";

interface SiteHeaderProps {
    headlines?: { title: string; slug: string; desk: string }[];
}

const DESKS = ["Politics", "Crime", "Business", "Entertainment", "Sports", "Science", "Education"];

export function SiteHeader({ headlines = [] }: SiteHeaderProps) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const isAdminParam = searchParams.get("admin") === "true";
    const { isAdmin } = useAdminSession();

    const [menuOpen, setMenuOpen] = useState(false);

    // Admin alerts state
    const [adminAlerts, setAdminAlerts] = useState<{ type: string; message: string }[]>([]);

    // Logo Placement override state
    const [logoPlacement, setLogoPlacement] = useState<'left' | 'center' | 'right'>('center');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data: any = await res.json();
                    if (data.settings && ['left', 'center', 'right'].includes(data.settings.logo_placement)) {
                        setLogoPlacement(data.settings.logo_placement);
                    }
                }
            } catch (e) {
                // Silently fallback to center
            }
        };
        fetchSettings();

        // Listen for immediate updates from Admin UI without reloading
        const handleAdminChange = (e: any) => {
            if (e.detail && ['left', 'center', 'right'].includes(e.detail)) {
                setLogoPlacement(e.detail);
            }
        };
        window.addEventListener('borg_logo_change', handleAdminChange);
        return () => window.removeEventListener('borg_logo_change', handleAdminChange);
    }, []);

    // The mobile panel closes when the reader navigates somewhere.
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    // ...and on Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    // Fetch admin alerts when admin is logged in
    useEffect(() => {
        if (!isAdmin) return;
        const token = localStorage.getItem("borg_admin_token");
        if (!token) return;

        async function fetchAlerts() {
            try {
                const res = await fetch("/api/admin/alerts", {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem("borg_admin_token")}` }
                });
                if (res.ok) {
                    const data = await res.json() as any;
                    setAdminAlerts(data.alerts || []);
                }
            } catch { }
        }
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 120000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    // Helper for ticker
    const getTickerHeadlines = (h: { title: string; slug: string; desk: string }[]) => {
        const items = h.length > 0 ? h : headlines;
        return [...items, ...items];
    };

    // One clock for the whole masthead, read in Eastern Time so the server and
    // the browser agree on both the date line and the edition label.
    const now = new Date();
    const currentDate = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
    }).toUpperCase();
    const edition = currentEditionName(now);

    // Admin alert icon map
    const alertIcons: Record<string, string> = {
        critical: 'CRITICAL',
        warning: 'WARNING',
        success: 'OK',
        info: 'INFO'
    };

    // Admin navigation links
    const adminNavLinks = [
        { label: "Dashboard", href: "/admin", icon: ShieldCheck },
        { label: "Editorial Queue", href: "/admin?tab=queue", icon: FileText },
        { label: "Analytics", href: "/admin?tab=analytics", icon: BarChart3 },
        { label: "Subscribers", href: "/admin?tab=audience", icon: Users },
        { label: "System Health", href: "/admin?tab=health", icon: Activity },
    ];

    return (
        <header className="flex flex-col w-full z-50">

            {/* 1. Breaking News Ticker / Admin Alerts Bar */}
            <div className={`${isAdmin ? 'bg-slate-900' : 'bg-destructive'} text-white flex items-center text-[11px] sm:text-xs font-medium tracking-wide w-full hidden sm:flex`}>
                {/* Label Area */}
                <div className={`flex items-center gap-2 px-5 py-1.5 border-r ${isAdmin ? 'border-slate-700 bg-slate-800' : 'border-red-800 bg-red-700'} whitespace-nowrap font-sans shadow-md z-10 shrink-0`}>
                    {isAdmin ? (
                        <>
                            <ShieldCheck className="w-4 h-4 text-amber-300" />
                            <span className="font-bold uppercase tracking-widest text-amber-300">Admin Alerts</span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="w-4 h-4" />
                            <span className="font-bold uppercase tracking-widest">Breaking</span>
                        </>
                    )}
                </div>

                {/* Scrolling Content */}
                {isAdmin ? (
                    <div className="overflow-hidden whitespace-nowrap px-4 py-1.5 flex-1 font-sans flex items-center relative">
                        <div className="ticker-animate flex gap-12 items-center min-w-max">
                            {adminAlerts.length > 0 ? (
                                [...adminAlerts, ...adminAlerts].map((alert, idx) => (
                                    <span key={idx}>
                                        {alertIcons[alert.type] || 'NOTE'}: {alert.message}
                                    </span>
                                ))
                            ) : (
                                <>
                                    <span>No active alerts</span>
                                    <span>No active alerts</span>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <DynamicTicker>
                        {(currentHeadlines) => {
                            const items = getTickerHeadlines(currentHeadlines);
                            if (items.length === 0) return <div className="px-4 py-1.5 flex-1 font-sans" />;
                            return (
                                <div className="overflow-hidden whitespace-nowrap px-4 py-1.5 flex-1 font-sans flex items-center relative">
                                    <div className="ticker-animate flex gap-12 items-center min-w-max">
                                        {items.map((item, idx) => (
                                            item.slug ? (
                                                <Link key={idx} href={`/${item.desk}/${item.slug}`} className="hover:underline focus-visible:underline focus-visible:outline-none">
                                                    {item.title}
                                                </Link>
                                            ) : (
                                                <span key={idx}>{item.title}</span>
                                            )
                                        ))}
                                    </div>
                                </div>
                            );
                        }}
                    </DynamicTicker>
                )}
            </div>

            {/* Header Block container */}
            <div className="bg-[#fcfbfc] dark:bg-background sticky top-0 z-40 w-full font-sans">

                {/* 2. Date Bar (Navy Bar) - Edge to Edge, narrower */}
                <div className="bg-primary text-primary-foreground w-full flex justify-between items-center px-6 h-8 text-[10px] sm:text-xs font-sans uppercase tracking-wide">
                    <span>{currentDate}</span>
                    <div className="flex items-center gap-3 sm:gap-5">
                        <span>{edition}</span>
                        {(isAdmin || isAdminParam) && (
                            <Link href="/admin" className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-300 text-black font-bold rounded-sm">
                                <ShieldAlert className="w-3 h-3" />
                                Admin Mode
                            </Link>
                        )}
                        <ThemeToggle />
                    </div>
                </div>

                {/* 3. Masthead Bar ("The Daily Borg") - CENTER ALIGNED */}
                <div className="w-full">
                    <div className="flex items-center justify-between py-6 px-6 max-w-[1400px] mx-auto w-full relative">

                        {/* Left Space to balance layout */}
                        <div className="hidden md:flex flex-1"></div>

                        {/* Logo area - Dynamic rendering based on placement setting */}
                        {logoPlacement === 'left' && (
                            <div className="flex items-center shrink-0 w-full md:w-auto">
                                <Link href="/" className="flex items-center gap-4 group">
                                    <Image
                                        src="/dailyborg-logo-512.png"
                                        alt="The Daily Borg mascot"
                                        width={64}
                                        height={64}
                                        className="group-hover:scale-105 transition-transform duration-200"
                                        priority
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl font-black text-foreground tracking-tight leading-none group-hover:opacity-90 transition-opacity">
                                            The Daily Borg
                                        </span>
                                        <span className="font-[family-name:var(--font-source-sans)] text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-[0.25em] md:tracking-[0.3em] mt-1 shrink-0">
                                            Broadcast Operations &amp; Reporting Grid
                                        </span>
                                    </div>
                                </Link>
                            </div>
                        )}

                        {logoPlacement === 'center' && (
                            <div className="flex flex-col items-center text-center shrink-0 w-full md:w-auto">
                                <Link href="/" className="flex flex-col items-center group">
                                    <Image
                                        src="/dailyborg-logo-512.png"
                                        alt="The Daily Borg mascot"
                                        width={64}
                                        height={64}
                                        className="-mb-2 group-hover:scale-105 transition-transform duration-200"
                                        priority
                                    />
                                    <span className="font-[family-name:var(--font-playfair)] text-4xl md:text-6xl font-black text-foreground tracking-tight leading-none group-hover:opacity-90 transition-opacity">
                                        The Daily Borg
                                    </span>
                                </Link>
                                <span className="font-[family-name:var(--font-source-sans)] text-[9px] sm:text-[10px] md:text-xs text-muted-foreground uppercase tracking-[0.25em] md:tracking-[0.3em] mt-2">
                                    Broadcast Operations &amp; Reporting Grid
                                </span>
                            </div>
                        )}

                        {logoPlacement === 'right' && (
                            <div className="flex items-center justify-end shrink-0 w-full md:w-auto">
                                <Link href="/" className="flex items-center gap-4 group">
                                    <div className="flex flex-col text-right">
                                        <span className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl font-black text-foreground tracking-tight leading-none group-hover:opacity-90 transition-opacity">
                                            The Daily Borg
                                        </span>
                                        <span className="font-[family-name:var(--font-source-sans)] text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-[0.25em] md:tracking-[0.3em] mt-1 shrink-0">
                                            Broadcast Operations &amp; Reporting Grid
                                        </span>
                                    </div>
                                    <Image
                                        src="/dailyborg-logo-512.png"
                                        alt="The Daily Borg mascot"
                                        width={64}
                                        height={64}
                                        className="group-hover:scale-105 transition-transform duration-200"
                                        priority
                                    />
                                </Link>
                            </div>
                        )}

                        {/* Right Utilities */}
                        <div className="hidden md:flex flex-1 items-center justify-end gap-6 shrink-0">
                            {isAdmin ? (
                                <Link href="/admin" className="bg-slate-900 text-amber-300 text-[10px] font-bold tracking-[0.1em] uppercase px-5 py-2.5 rounded shadow-sm hover:bg-slate-800 transition-colors ml-2 flex items-center gap-2">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Dashboard
                                </Link>
                            ) : (
                                <Link href="/subscribe" className="bg-[#1a2b4c] dark:bg-primary text-white text-[10px] font-bold tracking-[0.1em] uppercase px-5 py-2.5 rounded shadow-sm hover:bg-[#0f1c3a] transition-colors ml-2">
                                    Subscribe
                                </Link>
                            )}
                        </div>

                        {/* Mobile Menu button */}
                        <div className="md:hidden absolute right-6 top-1/2 -translate-y-1/2">
                            <button
                                type="button"
                                aria-label={menuOpen ? "Close menu" : "Open menu"}
                                aria-expanded={menuOpen}
                                aria-controls="mobile-nav-panel"
                                onClick={() => setMenuOpen((open) => !open)}
                                className="text-foreground p-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3b. Mobile navigation panel */}
                <nav
                    id="mobile-nav-panel"
                    aria-label="Sections"
                    hidden={!menuOpen}
                    className="md:hidden border-y border-border bg-background w-full"
                >
                    <ul className="flex flex-col py-2">
                        {(isAdmin ? adminNavLinks.map(l => ({ label: l.label, href: l.href })) : DESKS.map(d => ({ label: d, href: `/${d.toLowerCase()}` }))).map((link) => (
                            <li key={link.label}>
                                <Link
                                    href={link.href}
                                    className="block px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-muted transition-colors"
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                        {!isAdmin && (
                            <>
                                <li className="border-t border-border mt-2 pt-2">
                                    <Link href="/borg-record" className="block px-6 py-3 font-sans text-sm font-bold uppercase tracking-wider text-desk-borg hover:bg-muted transition-colors">
                                        Borg Record
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/borg-record/liar-liar" className="block px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-muted transition-colors">
                                        Liar Liar Index
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/borg-record/compare" className="block px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-muted transition-colors">
                                        Head to Head
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/subscribe" className="block px-6 py-3 font-sans text-sm font-semibold uppercase tracking-wider text-foreground hover:bg-muted transition-colors">
                                        Subscribe
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>

                {/* 4. Navigation Bar - Conditional: Admin links vs. Public desks */}
                <div className="hidden md:flex border-b border-border bg-background w-full relative z-20">
                    <nav aria-label="Desks" className="flex justify-center items-center w-full max-w-[1400px] mx-auto overflow-x-auto no-scrollbar gap-0">
                        {isAdmin ? (
                            <>
                                {adminNavLinks.map((link) => {
                                    const Icon = link.icon;
                                    return (
                                        <Link
                                            key={link.label}
                                            href={link.href}
                                            className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground/70 hover:text-foreground transition-colors px-4 py-2.5 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5"
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                            {link.label}
                                        </Link>
                                    );
                                })}
                            </>
                        ) : (
                            <>
                                {DESKS.map((desk) => (
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
                                    className="font-sans text-xs font-bold uppercase tracking-wider text-desk-borg hover:text-desk-borg/90 transition-colors px-5 py-3 whitespace-nowrap flex-shrink-0"
                                >
                                    Borg Record
                                </Link>
                            </>
                        )}
                    </nav>
                </div>

                {/* 5. Live Strip - passes admin state */}
                <DynamicLiveStrip isAdmin={isAdmin} edition={edition} />

            </div>
        </header>
    );
}
