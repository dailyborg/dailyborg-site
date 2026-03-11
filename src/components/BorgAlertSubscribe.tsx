"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Mail, MessageSquare, AlertCircle } from "lucide-react";

interface BorgAlertParams {
    politicianSlug: string;
    politicianName: string;
}

export function BorgAlertSubscribe({ politicianSlug, politicianName }: BorgAlertParams) {
    const [channel, setChannel] = useState<"email" | "whatsapp">("email");
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
                email: channel === "email" ? contactInfo : undefined,
                phone_number: channel === "whatsapp" ? contactInfo : undefined,
                tracked_politician: politicianSlug,
                plan_type: 'free', // Defaults to standard alerts unless they upgrade in the main portal
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
                    <h3 className="font-sans font-black text-xs uppercase tracking-[0.2em] text-[#DFA823]">
                        Set Borg Alert
                    </h3>
                </div>

                <h4 className="font-serif text-2xl md:text-3xl font-bold mb-2">Track {politicianName}</h4>
                <p className="text-background/80 text-sm mb-6 max-w-md">
                    Receive immediate notifications if statements contradict the record, or if a documented promise is broken.
                </p>

                <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
                    {/* Channel Toggle */}
                    <div className="flex items-center gap-2 bg-background/10 p-1 w-fit rounded-sm">
                        <button
                            type="button"
                            onClick={() => setChannel("email")}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${channel === 'email' ? 'bg-background text-foreground' : 'text-background/60 hover:text-background'}`}
                        >
                            <Mail className="w-3 h-3" /> Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setChannel("whatsapp")}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${channel === 'whatsapp' ? 'bg-[#25D366] text-background' : 'text-background/60 hover:text-background'}`}
                        >
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                        <input
                            type={channel === 'email' ? 'email' : 'tel'}
                            className="flex-1 bg-background/10 border border-background/20 px-4 py-3 text-sm text-background placeholder:text-background/50 focus:outline-none focus:border-background transition-colors"
                            placeholder={channel === 'email' ? 'secure@email.com' : '+1 (555) 000-0000'}
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

                    {channel === 'whatsapp' && (
                        <p className="text-[10px] text-background/60 inline-flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" /> Include country code for WhatsApp (e.g. +1)
                        </p>
                    )}

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
