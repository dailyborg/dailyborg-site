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
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchHeadlines() {
            try {
                const res = await fetch("/api/headlines");
                if (res.ok) {
                    const data = await res.json() as HeadlineItem[];
                    setHeadlines(data);
                }
            } catch (err) {
                console.error("Failed to pulse headlines:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchHeadlines();
        // Refresh every 5 minutes to keep it "Live" without hammering the D1
        const interval = setInterval(fetchHeadlines, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return <>{children(headlines)}</>;
}
