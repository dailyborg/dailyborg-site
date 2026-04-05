"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Lightweight hook that checks localStorage for the admin token.
 * All header components consume this to conditionally render admin vs. public content.
 * Listens for both cross-tab storage events AND same-tab custom events.
 */
export function useAdminSession() {
    const [isAdmin, setIsAdmin] = useState(false);

    const checkToken = useCallback(() => {
        const token = localStorage.getItem("borg_admin_token");
        setIsAdmin(!!token && token.length > 0);
    }, []);

    useEffect(() => {
        // Initial check
        checkToken();

        // Cross-tab changes
        const storageHandler = () => checkToken();
        window.addEventListener("storage", storageHandler);

        // Same-tab changes (dispatched by admin page on login/logout)
        window.addEventListener("borg_admin_change", checkToken);

        return () => {
            window.removeEventListener("storage", storageHandler);
            window.removeEventListener("borg_admin_change", checkToken);
        };
    }, [checkToken]);

    return { isAdmin };
}

