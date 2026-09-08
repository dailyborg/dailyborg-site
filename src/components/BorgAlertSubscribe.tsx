"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

interface BorgAlertParams {
    politicianSlug: string;
    politicianName: string;
}

export function BorgAlertSubscribe({ politicianSlug, politicianName }: BorgAlertParams) {
    // Email only. WhatsApp delivery does not exist yet (the worker only logs a stub), so it is not offered.
    const channel = "email" as const;
    const [contactInfo, setContactInfo] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setResult(null);

        try {
            const payload = {
                delivery_channel: channel,
                email: contactInfo,
                tracked_politicians: [politicianSlug],
                frequency: 'daily'
            };

            const res = await fetch("/api/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data: any = await res.json();
            if (res.ok) {
                setResult({ success: true, message: `Borg Alert active for ${politicianName}.` });
                setContactInfo(""); // Clear form on success
            } else {
                setResult({ success: false, message: data.error || "Failed to set alert." });
            }
        } catch (err: any) {
            setResult({ success: false, message: "A network error occurred." });
        } finally {
            setIsLoading(false);
        }
    };

    if (result?.success) {
        return (
            <div className="bg-muted/10 border-2 border-foreground p-6 md:p-8 flex flex-col items-center justify-center text-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-success" />
                <h3 className="font-serif text-2xl font-bold tracking-tight">Alert Verified</h3>
                <p className="text-sm text-muted-foreground max-w-sm uppercase tracking-wider font-bold">
                    {result.message}
                </p>
                <div className="text-xs text-foreground mt-2 border border-border px-3 py-1 font-mono bg-background">
                    ID: {politicianSlug}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-foreground text-background p-6 md:p-8 relative overflow-hidden">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-background/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-background/5 rounded-full -ml-12 -mb-12 pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-[#DFA823] animate-pulse"></div>
                    <span className="font-sans font-black text-xs uppercase tracking-[0.2em] text-[#DFA823]">
                        Set Borg Alert
                    </span>
                </div>

                <h3 className="font-serif text-2xl md:text-3xl font-bold mb-2">Track {politicianName}</h3>
                <p className="text-background/80 text-sm mb-6 max-w-md">
                    Receive immediate notifications if statements contradict the record, or if a documented promise is broken.
                </p>

                <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-background/80">
                        <Mail className="w-3 h-3" /> Email alerts
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                        <input
                            type="email"
                            className="flex-1 bg-background/10 border border-background/20 px-4 py-3 text-sm text-background placeholder:text-background/50 focus:ring-2 focus:ring-background/60 focus:border-background transition-colors"
                            placeholder="you@example.com"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !contactInfo}
                            className="bg-background text-foreground font-bold uppercase tracking-widest text-sm px-6 py-3 hover:bg-background/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center min-w-[140px]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Track"}
                        </button>
                    </div>

                    {result?.message && !result.success && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold mt-2">
                            {result.message}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
