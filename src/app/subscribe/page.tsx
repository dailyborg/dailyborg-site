"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Mail, MessageSquare, Loader2, ArrowRight, AlertCircle } from "lucide-react";

const TOPICS = [
    "U.S. Politics",
    "Global Conflicts",
    "Economy & Markets",
    "Technology",
    "Healthcare",
    "Environment",
    "Crime & Justice",
    "Education",
    "Science",
    "Entertainment"
];

export default function SubscribePage() {
    const [step, setStep] = useState(1);

    // Form State
    const [topics, setTopics] = useState<string[]>([]);
    const [channel, setChannel] = useState<"email" | "whatsapp">("email");
    const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
    const [plan, setPlan] = useState<"free" | "paid">("free");

    const [contactInfo, setContactInfo] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

    const toggleTopic = (topic: string) => {
        if (topics.includes(topic)) {
            setTopics(topics.filter(t => t !== topic));
        } else {
            setTopics([...topics, topic]);
        }
    };

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setResult(null);

        try {
            const payload = {
                topics,
                delivery_channel: channel,
                frequency,
                plan_type: plan,
                email: channel === "email" ? contactInfo : undefined,
                phone_number: channel === "whatsapp" ? contactInfo : undefined,
            };

            const res = await fetch("/api/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = (await res.json()) as any;
            if (res.ok) {
                setResult({ success: true, message: data.message });
                // Redirect to Stripe checkout for Premium
                if (plan === "paid") {
                    setTimeout(async () => {
                        try {
                            const checkoutRes = await fetch("/api/stripe/checkout", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    subscriberId: data.id,
                                    email: channel === "email" ? contactInfo : undefined
                                })
                            });
                            const checkoutData = (await checkoutRes.json()) as any;
                            if (checkoutData.url) {
                                window.location.href = checkoutData.url;
                            } else {
                                setResult({ success: false, message: "Payment setup failed." });
                            }
                        } catch (err) {
                            setResult({ success: false, message: "Payment network error." });
                        }
                    }, 1500);
                }
            } else {
                setResult({ success: false, message: data.error });
            }
        } catch (err: any) {
            setResult({ success: false, message: "A network error occurred." });
        } finally {
            setIsLoading(false);
        }
    };

    if (result?.success) {
        return (
            <div className="container mx-auto px-4 py-24 min-h-[60vh] flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-16 h-16 text-success mb-6" />
                <h1 className="font-serif text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">You're on the Grid.</h1>
                <p className="text-xl text-muted-foreground font-serif max-w-2xl mx-auto leading-relaxed mb-8">
                    {plan === 'paid' ? "We are redirecting you to complete your premium activation." : "We've logged your preferences. You'll strictly receive notifications for the topics you care about."}
                </p>
                <a href="/" className="font-bold uppercase tracking-widest text-xs border-b-2 border-foreground pb-1 hover:text-accent hover:border-accent transition-colors">
                    Return to Homepage
                </a>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 md:py-24 max-w-4xl">

            <div className="mb-12 text-center">
                <h1 className="font-serif text-4xl md:text-5xl font-extrabold tracking-tight mb-4">Command Your Feed</h1>
                <p className="text-xl text-muted-foreground font-serif max-w-2xl mx-auto leading-relaxed">
                    Filter out the noise. Pick exactly what intelligence you want delivered and how you want to read it.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* Onboarding Wizard */}
                <div className="lg:col-span-8 space-y-12">

                    {/* Step 1: Topics */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b-2 border-border pb-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background font-bold font-mono text-sm leading-none">1</span>
                            <h2 className="font-serif text-2xl font-bold tracking-tight">Select Intelligence Desks</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {TOPICS.map(topic => (
                                <button
                                    key={topic}
                                    type="button"
                                    onClick={() => toggleTopic(topic)}
                                    className={`p-4 border text-left flex flex-col justify-between transition-all duration-200 ${topics.includes(topic) ? 'border-foreground bg-foreground text-background shadow-md transform -translate-y-1' : 'border-border hover:border-foreground/50 hover:bg-muted/10'}`}
                                >
                                    <span className="font-bold text-sm leading-tight">{topic}</span>
                                    {topics.includes(topic) && <CheckCircle2 className="w-4 h-4 mt-2" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Delivery Config */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b-2 border-border pb-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background font-bold font-mono text-sm leading-none">2</span>
                            <h2 className="font-serif text-2xl font-bold tracking-tight">Delivery Vectors</h2>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Select Channel</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setChannel("email")}
                                        className={`flex items-center justify-center gap-3 p-4 border font-bold ${channel === 'email' ? 'border-foreground bg-muted/20' : 'border-border text-muted-foreground hover:border-foreground/50'}`}
                                    >
                                        <Mail className="w-5 h-5" /> Email
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChannel("whatsapp")}
                                        className={`flex items-center justify-center gap-3 p-4 border font-bold ${channel === 'whatsapp' ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366]' : 'border-border text-muted-foreground hover:border-foreground/50'}`}
                                    >
                                        <MessageSquare className="w-5 h-5" /> WhatsApp
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Select Frequency</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFrequency("daily")}
                                        className={`p-4 border font-bold ${frequency === 'daily' ? 'border-foreground bg-muted/20' : 'border-border text-muted-foreground hover:border-foreground/50'}`}
                                    >
                                        Daily Briefing
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFrequency("weekly")}
                                        className={`p-4 border font-bold ${frequency === 'weekly' ? 'border-foreground bg-muted/20' : 'border-border text-muted-foreground hover:border-foreground/50'}`}
                                    >
                                        Weekly Recap
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Tier */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b-2 border-border pb-4">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background font-bold font-mono text-sm leading-none">3</span>
                            <h2 className="font-serif text-2xl font-bold tracking-tight">Select Access Tier</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Free Tier */}
                            <div
                                onClick={() => setPlan("free")}
                                className={`cursor-pointer p-6 border-2 relative transition-all ${plan === 'free' ? 'border-foreground shadow-lg' : 'border-border/50 hover:border-border grayscale opacity-70'}`}
                            >
                                <h3 className="font-serif text-2xl font-bold mb-1">Standard Agent</h3>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-3xl font-extrabold font-serif">$0</span>
                                    <span className="text-muted-foreground font-bold text-sm uppercase tracking-widest">/forever</span>
                                </div>
                                <ul className="space-y-3 text-sm font-medium">
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-foreground/50 mt-0.5" /> Curated notifications via {channel}</li>
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-foreground/50 mt-0.5" /> Direct links to articles on site</li>
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-foreground/50 mt-0.5" /> Save topics and preferences</li>
                                </ul>
                            </div>

                            {/* Paid Tier */}
                            <div
                                onClick={() => setPlan("paid")}
                                className={`cursor-pointer p-6 border-2 relative transition-all ${plan === 'paid' ? 'border-accent shadow-lg bg-accent/5' : 'border-border/50 hover:border-accent/40 opacity-70'}`}
                            >
                                {plan === 'paid' && <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 -mt-3 mr-4">Recommended</div>}
                                <h3 className="font-serif text-2xl font-bold text-accent mb-1">Premium Director</h3>
                                <div className="flex items-baseline gap-1 mb-6 text-accent">
                                    <span className="text-3xl font-extrabold font-serif">$0.99</span>
                                    <span className="text-accent/70 font-bold text-sm uppercase tracking-widest">/month</span>
                                </div>
                                <ul className="space-y-3 text-sm font-medium">
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-accent mt-0.5" /> <strong className="text-accent">Full articles delivered securely to your {channel} inbox</strong></li>
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-accent/50 mt-0.5" /> No need to click away or visit the site</li>
                                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-accent/50 mt-0.5" /> Supports independent architecture</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Sidebar Checkout */}
                <div className="lg:col-span-4 lg:sticky lg:top-24 h-fit">
                    <div className="bg-muted/10 border border-border p-6 md:p-8">
                        <h3 className="font-serif text-xl font-bold uppercase tracking-tight border-b-2 border-border pb-3 mb-6">Execution Sequence</h3>

                        <form onSubmit={handleSubscribe} className="space-y-6">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                                    {channel === 'email' ? 'Secure Email Address' : 'WhatsApp Phone Number'}
                                </label>
                                <input
                                    type={channel === 'email' ? 'email' : 'tel'}
                                    className="w-full bg-background border border-border p-3 font-medium outline-none focus:border-foreground transition-colors"
                                    placeholder={channel === 'email' ? 'you@secure.net' : '+1 (555) 000-0000'}
                                    value={contactInfo}
                                    onChange={(e) => setContactInfo(e.target.value)}
                                    required
                                />
                                {channel === 'whatsapp' && <p className="text-[10px] text-muted-foreground mt-2 inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Include country code (e.g. +1)</p>}
                            </div>

                            {result?.message && !result.success && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold">
                                    {result.message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || topics.length === 0 || !contactInfo}
                                className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-bold uppercase tracking-widest text-sm py-4 hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : plan === 'paid' ? (
                                    <>Proceed to Checkout <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                                ) : (
                                    <>Activate Uplink <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>

                            {topics.length === 0 && (
                                <p className="text-[10px] text-destructive uppercase tracking-widest font-bold text-center mt-2">
                                    Select at least one desk to continue
                                </p>
                            )}
                        </form>
                    </div>
                </div>

            </div>
        </div>
    );
}
