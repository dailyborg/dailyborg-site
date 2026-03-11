"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, FileText, AlertTriangle, ShieldCheck } from "lucide-react";

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passphrase, setPassphrase] = useState("");
    const [authError, setAuthError] = useState("");

    // Dashboard Data
    const [metrics, setMetrics] = useState({ pendingCount: 0, duplicatesCaughtToday: 0, successfulInsertsToday: 0 });
    const [articles, setArticles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Editor State
    const [selectedArticle, setSelectedArticle] = useState<any>(null);
    const [editForm, setEditForm] = useState({ title: "", excerpt: "", content_html: "" });

    // Handle Authentication Check
    const login = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        setIsLoading(true);

        try {
            // Test the passphrase against the metrics endpoint
            const res = await fetch('/api/admin/metrics', {
                headers: { 'Authorization': `Bearer ${passphrase}` }
            });

            if (res.ok) {
                const data = await res.json() as any;
                setMetrics(data);
                setIsAuthenticated(true);
                localStorage.setItem("borg_admin_token", passphrase);
                fetchArticles(passphrase);
            } else {
                setAuthError("Invalid Passphrase. Access Denied.");
            }
        } catch (err) {
            setAuthError("Failed to connect to the Admin Hub.");
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-login on mount if token exists
    useEffect(() => {
        const token = localStorage.getItem("borg_admin_token");
        if (token) {
            setPassphrase(token);
            // Quick silent validation
            fetch('/api/admin/metrics', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json() as any)
                .then(data => {
                    if (data.error) throw new Error();
                    setMetrics(data);
                    setIsAuthenticated(true);
                    fetchArticles(token);
                })
                .catch(() => localStorage.removeItem("borg_admin_token"));
        }
    }, []);

    const fetchArticles = async (token: string) => {
        const res = await fetch('/api/admin/articles', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data: any = await res.json();
            setArticles(data.articles || []);
        }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        const res = await fetch(`/api/admin/articles/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${passphrase}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ...editForm, action })
        });

        if (res.ok) {
            // Refresh
            setSelectedArticle(null);
            fetchArticles(passphrase);
            const metricsRes = await fetch('/api/admin/metrics', { headers: { 'Authorization': `Bearer ${passphrase}` } });
            if (metricsRes.ok) setMetrics(await metricsRes.json() as any);
        } else {
            alert(`Failed to ${action} article.`);
        }
    };

    const openEditor = (article: any) => {
        setSelectedArticle(article);
        setEditForm({
            title: article.title,
            excerpt: article.excerpt,
            content_html: article.content_html
        });
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <form onSubmit={login} className="bg-muted/50 p-8 border border-border max-w-md w-full flex flex-col gap-4 text-center">
                    <ShieldCheck className="w-12 h-12 mx-auto text-primary" />
                    <h1 className="font-serif text-3xl font-black">Admin Access Required</h1>
                    <p className="text-sm text-muted-foreground mb-4">Enter your passphrase to access the ingestion queue and editorial overrides.</p>

                    <input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Passphrase"
                        className="p-3 bg-background border border-border text-center font-mono focus:outline-none focus:border-primary"
                        required
                    />

                    {authError && <p className="text-red-500 text-sm font-bold">{authError}</p>}

                    <button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground font-bold uppercase tracking-wider p-3 hover:opacity-90 transition-opacity">
                        {isLoading ? "Authenticating..." : "Unlock Dashboard"}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="bg-foreground text-background p-4 flex justify-between items-center px-6">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-accent" />
                    <h1 className="font-sans font-bold tracking-widest uppercase">The Daily Borg Admin</h1>
                </div>
                <button onClick={() => { localStorage.removeItem("borg_admin_token"); setIsAuthenticated(false); }} className="text-xs uppercase tracking-wider text-background/60 hover:text-background font-bold">
                    Lock Terminal
                </button>
            </header>

            <main className="max-w-7xl mx-auto p-6 flex flex-col gap-8 mt-4">
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-border p-6 flex flex-col gap-2 bg-muted/20">
                        <div className="flex items-center gap-2 text-muted-foreground uppercase text-xs font-bold tracking-wider">
                            <FileText className="w-4 h-4" /> Pending Approval Queue
                        </div>
                        <div className="text-5xl font-black font-[family-name:var(--font-playfair)]">{metrics.pendingCount}</div>
                        <p className="text-xs text-muted-foreground">Articles waiting for human review</p>
                    </div>

                    <div className="border border-border p-6 flex flex-col gap-2 bg-muted/20">
                        <div className="flex items-center gap-2 text-desk-politics uppercase text-xs font-bold tracking-wider">
                            <CheckCircle2 className="w-4 h-4" /> Successfully Published Today
                        </div>
                        <div className="text-5xl font-black font-[family-name:var(--font-playfair)]">{metrics.successfulInsertsToday}</div>
                        <p className="text-xs text-muted-foreground">AI articles cleared by gates</p>
                    </div>

                    <div className="border border-red-500/20 p-6 flex flex-col gap-2 bg-red-500/5">
                        <div className="flex items-center gap-2 text-red-500 uppercase text-xs font-bold tracking-wider">
                            <AlertTriangle className="w-4 h-4" /> Duplicates Caught Today
                        </div>
                        <div className="text-5xl text-red-500 font-black font-[family-name:var(--font-playfair)]">{metrics.duplicatesCaughtToday}</div>
                        <p className="text-xs text-red-500/80">Silently dropped by Event Slug matching</p>
                    </div>
                </div>

                {/* Main Queue List */}
                <div className="flex flex-col gap-4">
                    <h2 className="font-serif text-3xl font-bold border-b-2 border-foreground pb-2">Editorial Review Queue</h2>

                    {articles.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            The queue is currently empty. The ingestion worker has not generated any new pending drafts.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {articles.map((article: any) => (
                                <div key={article.id} className="border border-border p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:bg-muted/10 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-desk-politics/10 text-desk-politics px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">{article.desk}</span>
                                            <span className="text-xs text-muted-foreground">Score: {article.confidence_score}</span>
                                            {article.sources && (
                                                <span className="text-xs text-muted-foreground">Sources: {JSON.parse(article.sources).length}</span>
                                            )}
                                        </div>
                                        <h3 className="font-serif text-xl font-bold">{article.title}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{article.excerpt}</p>
                                    </div>
                                    <button
                                        onClick={() => openEditor(article)}
                                        className="whitespace-nowrap bg-foreground text-background px-6 py-2 uppercase tracking-wider text-xs font-bold hover:opacity-90"
                                    >
                                        Review Draft
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Editorial Modal Overlay */}
            {selectedArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
                    <div className="bg-background border-2 border-foreground max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                        <div className="bg-foreground text-background p-4 flex justify-between items-center">
                            <h2 className="font-sans font-bold tracking-widest uppercase">Manual Editorial Review</h2>
                            <button onClick={() => setSelectedArticle(null)} className="text-background/60 hover:text-background"><XCircle className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">
                            {/* Editor Form */}
                            <div className="flex-1 flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Optimized Headline</label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                        className="text-2xl font-serif font-bold p-2 border border-border bg-muted/20 focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sub-deck Excerpt</label>
                                    <textarea
                                        value={editForm.excerpt}
                                        onChange={e => setEditForm({ ...editForm, excerpt: e.target.value })}
                                        className="text-sm p-2 border border-border bg-muted/20 min-h-[80px] focus:outline-none focus:border-primary"
                                    />
                                </div>

                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HTML Body Content (Override AI Hallucinations)</label>
                                    <textarea
                                        value={editForm.content_html}
                                        onChange={e => setEditForm({ ...editForm, content_html: e.target.value })}
                                        className="flex-1 text-sm font-mono p-4 border border-border bg-muted/10 min-h-[300px] focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* Reference Context */}
                            <div className="w-full md:w-80 flex flex-col gap-6 border-l border-border pl-0 md:pl-6">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-2 block">Event Identity</span>
                                    <p className="font-mono text-xs">{selectedArticle.slug}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-2 block">Parsed Sources</span>
                                    {selectedArticle.sources && JSON.parse(selectedArticle.sources).map((s: any, idx: number) => (
                                        <div key={idx} className="bg-muted p-2 rounded-sm text-xs break-all">
                                            <strong>{s.name}</strong><br />
                                            {s.url ? <a href={s.url} target="_blank" className="text-blue-500 hover:underline">{s.url}</a> : "No URL"}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-border p-4 bg-muted/30 gap-4 flex justify-end">
                            <button
                                onClick={() => handleAction(selectedArticle.id, 'reject')}
                                className="px-6 py-2 border border-destructive text-destructive font-bold uppercase tracking-wider text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            >
                                Reject & Delete
                            </button>
                            <button
                                onClick={() => handleAction(selectedArticle.id, 'approve')}
                                className="px-6 py-2 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-xs hover:opacity-90 flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Approve & Publish to Live
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
