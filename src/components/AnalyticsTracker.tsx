"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker() {
    const pathname = usePathname();
    const hasSentRef = useRef(false);

    useEffect(() => {
        // Prevent double tracking in React Strict Mode
        if (hasSentRef.current) return;
        hasSentRef.current = true;

        if (typeof window !== "undefined") {
            fetch("/api/admin/analytics/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: pathname,
                    userAgent: navigator.userAgent
                })
            }).catch(() => { /* silent fail for analytics */ });
        }
    }, [pathname]);

    return null; // Invisible component
}
