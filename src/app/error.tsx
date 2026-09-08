"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Page error:", error);
    }, [error]);

    return (
        <div className="container max-w-[900px] mx-auto px-4 py-24 md:py-32">
            <p className="font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">
                Something went wrong
            </p>
            <h1 className="font-[family-name:var(--font-playfair)] text-5xl md:text-6xl font-black tracking-tight uppercase leading-none border-b-4 border-foreground pb-8">
                This page did not load
            </h1>

            <p className="font-[family-name:var(--font-source-sans)] text-xl text-foreground leading-relaxed mt-10 max-w-[640px]">
                The page hit an error on its way to you. Try again. If it keeps happening, the newsroom
                systems may be busy, so give it a minute.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
                <button
                    type="button"
                    onClick={() => reset()}
                    className="bg-primary text-primary-foreground font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest px-6 py-3 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                    Try again
                </button>
                <a
                    href="/"
                    className="border border-foreground text-foreground font-[family-name:var(--font-source-sans)] text-xs font-bold uppercase tracking-widest px-6 py-3 hover:bg-muted transition-colors"
                >
                    Front page
                </a>
            </div>

            {error.digest && (
                <p className="mt-10 font-[family-name:var(--font-source-sans)] text-xs uppercase tracking-widest text-muted-foreground">
                    Reference: {error.digest}
                </p>
            )}
        </div>
    );
}
