"use client";

import { useState, useEffect } from "react";

/**
 * Lightweight hook that checks localStorage for the admin token.
 * All header components consume this to conditionally render admin vs. public content.
 */
export function useAdminSession() {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("borg_admin_token");
        setIsAdmin(!!token && token.length > 0);

        // Listen for storage changes (e.g., login/logout in another tab)
        const handler = () => {
            const t = localStorage.getItem("borg_admin_token");
            setIsAdmin(!!t && t.length > 0);
        };
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }, []);

    return { isAdmin };
}
