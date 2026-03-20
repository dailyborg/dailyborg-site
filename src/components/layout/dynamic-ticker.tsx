"use client";

import React, { useState, useEffect } from "react";

interface DynamicTickerProps {
    children: (headlines: string[]) => React.ReactNode;
}

export function DynamicTicker({ children }: DynamicTickerProps) {
    const [headlines, setHeadlines] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchHeadlines() {
            try {
                const res = await fetch("/api/headlines");
                if (res.ok) {
                    const data = await res.json() as string[];
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
