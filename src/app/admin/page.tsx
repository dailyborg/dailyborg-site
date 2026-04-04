"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, FileText, AlertTriangle, ShieldCheck, BarChart3, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passphrase, setPassphrase] = useState("");
    const [authError, setAuthError] = useState("");
    const [activeTab, setActiveTab] = useState<'queue' | 'analytics' | 'audience'>('queue');

    // Dashboard Data
    const [metrics, setMetrics] = useState({ 
        pendingCount: 0, 
        duplicatesCaughtToday: 0, 
        successfulInsertsToday: 0,
        uniqueVisitorsToday: 0,
        totalSubscribers: 0,
        payingSubscribers: 0,
        chartData: [] as {name: string, visitors: number}[]
    });
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
            const res = await fetch('/api/admin/metrics', {
                headers: { 'Authorization': `Bearer ${passphrase}` }
            });

            if (res.ok) {
                const data = await res.json() as any;
                setMetrics(data);
                setIsAuthenticated(true);
                localStorage.setItem("borg_admin_token", passphrase);
                // The cookies API (which actually bypasses our tracking) could be hit here or set by server, 
                // but setting in localStorage + manually checking on tracking works. 
                // Wait, our tracker checks cookie. We should set cookie to bypass tracker!
                document.cookie = `borg_admin_token=${passphrase}; path=/; max-age=86400`;
                
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
            document.cookie = `borg_admin_token=${token}; path=/; max-age=86400`;
            fetch('/api/admin/metrics', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json() as any)
                .then(data => {
                    if (data.error) throw new Error();
                    setMetrics(data);
                    setIsAuthenticated(true);
                    fetchArticles(token);
                })
                .catch(() => {
                    localStorage.removeItem("borg_admin_token");
                    document.cookie = "borg_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                });
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
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-6 flex items-center gap-3 border-b border-slate-800">
                    <ShieldCheck className="w-6 h-6 text-blue-400" />
                    <h1 className="font-serif font-black text-xl tracking-wider uppercase">Borg Admin</h1>
                </div>
                
                <nav className="flex-1 p-4 flex flex-col gap-2">
                    <button 
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'queue' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <FileText className="w-5 h-5" /> Editorial Queue
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <BarChart3 className="w-5 h-5" /> Web Analytics
                    </button>
                    <button 
                        onClick={() => setActiveTab('audience')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'audience' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <Users className="w-5 h-5" /> Audience CRM
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button onClick={() => { 
                        localStorage.removeItem("borg_admin_token"); 
                        document.cookie = "borg_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                        setIsAuthenticated(false); 
                    }} className="w-full text-sm uppercase tracking-wider text-slate-400 hover:text-white font-bold text-left px-4">
                        Lock Terminal
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                {activeTab === 'analytics' && (
                    <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
                        <h2 className="font-serif text-4xl font-black">Web Analytics</h2>
                        
                        {/* Traffic Overview */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-6">Traffic Overview (7 Days)</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={metrics.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Line type="monotone" dataKey="visitors" stroke="#2563EB" strokeWidth={4} dot={{r: 6, fill: '#2563EB', strokeWidth: 2, stroke: '#ffffff'}} activeDot={{ r: 8 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* KPIS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10"><Users className="w-16 h-16 text-blue-600" /></div>
                                <div className="text-slate-500 uppercase text-xs font-bold tracking-wider">Unique Visitors (Today)</div>
                                <div className="text-5xl font-black text-slate-900">{metrics.uniqueVisitorsToday}</div>
                                <p className="text-xs text-emerald-600 font-bold">+12% from yesterday</p>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10"><FileText className="w-16 h-16 text-purple-600" /></div>
                                <div className="text-slate-500 uppercase text-xs font-bold tracking-wider">Published Articles</div>
                                <div className="text-5xl font-black text-slate-900">{metrics.successfulInsertsToday}</div>
                                <p className="text-xs text-slate-500">Autonomous inserts today</p>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10"><AlertTriangle className="w-16 h-16 text-amber-500" /></div>
                                <div className="text-slate-500 uppercase text-xs font-bold tracking-wider">Duplicates Caught</div>
                                <div className="text-5xl font-black text-slate-900">{metrics.duplicatesCaughtToday}</div>
                                <p className="text-xs text-slate-500">Filtered by Vectorize engine</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'audience' && (
                    <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
                        <h2 className="font-serif text-4xl font-black">Audience CRM</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                                <div className="text-slate-400 uppercase text-xs font-bold tracking-wider mb-2">Total Subscribers</div>
                                <div className="text-5xl font-black">{metrics.totalSubscribers}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
                                <div className="text-blue-200 uppercase text-xs font-bold tracking-wider mb-2">Paying Subscribers</div>
                                <div className="text-5xl font-black">{metrics.payingSubscribers}</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700">Subscriber Directory</h3>
                                <input type="text" placeholder="Search audiences..." className="px-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="p-12 text-center text-slate-500">
                                <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                                <p>Subscriber grid view is loading...</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'queue' && (
                    <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-end">
                            <h2 className="font-serif text-4xl font-black">Editorial Queue</h2>
                            <div className="bg-blue-100 text-blue-800 font-bold px-4 py-2 rounded-xl text-sm border border-blue-200">
                                {metrics.pendingCount} Pending Reviews
                            </div>
                        </div>

                        {articles.length === 0 ? (
                            <div className="bg-white p-12 text-center text-slate-500 rounded-2xl border border-slate-200 shadow-sm">
                                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
                                <h3 className="text-lg font-bold text-slate-800 mb-1">You're all caught up!</h3>
                                <p>The ingestion worker has not generated any new pending drafts.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {articles.map((article: any) => (
                                    <div key={article.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-all">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider">{article.desk}</span>
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Score: {article.confidence_score}</span>
                                                {article.sources && (
                                                    <span className="text-xs text-slate-500">Sources: {JSON.parse(article.sources).length}</span>
                                                )}
                                            </div>
                                            <h3 className="font-serif text-2xl font-bold text-slate-900">{article.title}</h3>
                                            <p className="text-sm text-slate-600 line-clamp-2 max-w-3xl">{article.excerpt}</p>
                                        </div>
                                        <button
                                            onClick={() => openEditor(article)}
                                            className="whitespace-nowrap bg-slate-900 text-white px-8 py-3 rounded-xl uppercase tracking-wider text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm"
                                        >
                                            Review Draft
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Editorial Modal Overlay */}
            {selectedArticle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-8">
                    <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-400" />
                                <h2 className="font-sans font-bold tracking-widest uppercase text-sm">Manual Editorial Review</h2>
                            </div>
                            <button onClick={() => setSelectedArticle(null)} className="text-slate-400 hover:text-white transition-colors"><XCircle className="w-6 h-6" /></button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-1 flex flex-col lg:flex-row gap-10 bg-slate-50">
                            {/* Editor Form */}
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Optimized Headline</label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                        className="text-3xl font-serif font-black p-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sub-deck Excerpt</label>
                                    <textarea
                                        value={editForm.excerpt}
                                        onChange={e => setEditForm({ ...editForm, excerpt: e.target.value })}
                                        className="text-base p-4 bg-white border border-slate-200 rounded-xl min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                                    />
                                </div>

                                <div className="flex flex-col gap-2 flex-1">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">HTML Body Content (Override AI Hallucinations)</label>
                                    <textarea
                                        value={editForm.content_html}
                                        onChange={e => setEditForm({ ...editForm, content_html: e.target.value })}
                                        className="flex-1 text-sm font-mono p-6 bg-slate-900 text-green-400 border border-slate-800 rounded-xl min-h-[300px] focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Reference Context */}
                            <div className="w-full lg:w-96 flex flex-col gap-6 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm h-fit">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-3 block">Event Identity</span>
                                    <p className="font-mono text-xs bg-slate-100 p-3 rounded-lg text-slate-700">{selectedArticle.slug}</p>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-1 block">Parsed Sources</span>
                                    {selectedArticle.sources && JSON.parse(selectedArticle.sources).map((s: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs break-all flex flex-col gap-1">
                                            <strong className="text-slate-800">{s.name}</strong>
                                            {s.url ? <a href={s.url} target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">{s.url}</a> : <span className="text-slate-400">No URL Provided</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="border-t border-slate-200 p-6 bg-white gap-4 flex justify-end items-center">
                            <button
                                onClick={() => handleAction(selectedArticle.id, 'reject')}
                                className="px-8 py-3 rounded-xl text-red-600 font-bold uppercase tracking-wider text-xs hover:bg-red-50 transition-colors"
                            >
                                Reject & Delete
                            </button>
                            <button
                                onClick={() => handleAction(selectedArticle.id, 'approve')}
                                className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-blue-700 flex items-center gap-2 shadow-sm shadow-blue-600/20"
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
