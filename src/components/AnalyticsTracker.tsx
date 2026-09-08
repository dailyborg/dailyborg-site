"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker() {
    const pathname = usePathname();
    // Remembers the last path we reported, so React Strict Mode's double effect does not
    // double count, but a real navigation to a new path still gets tracked.
    const lastPathRef = useRef<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!pathname) return;
        if (lastPathRef.current === pathname) return;
        lastPathRef.current = pathname;

        fetch("/api/admin/analytics/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: pathname,
                referrer: document.referrer || ""
            })
        }).catch(() => { /* analytics never blocks the page */ });
    }, [pathname]);

    return null; // Invisible component
}
