"use client";

import React, { useState, useEffect } from "react";

interface HeadlineItem {
    title: string;
    slug: string;
    desk: string;
}

interface DynamicTickerProps {
    children: (headlines: HeadlineItem[]) => React.ReactNode;
}

export function DynamicTicker({ children }: DynamicTickerProps) {
    const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);

    useEffect(() => {
        async function fetchHeadlines() {
            try {
                const res = await fetch("/api/headlines");
                if (res.ok) {
                    const data = await res.json() as HeadlineItem[];
                    setHeadlines(data);
                }
            } catch (err) {
                console.error("Failed to load headlines:", err);
            }
        }

        fetchHeadlines();
        // Refresh every 10 minutes so the crawl stays current without hammering D1.
        const interval = setInterval(fetchHeadlines, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return <>{children(headlines)}</>;
}
