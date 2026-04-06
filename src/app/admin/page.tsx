"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, FileText, AlertTriangle, ShieldCheck, BarChart3, Users, Activity, Zap, RefreshCcw, MessageSquare, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatTimeAgo } from "@/lib/utils";


function AdminDashboardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passphrase, setPassphrase] = useState("");
    const [authError, setAuthError] = useState("");
    const [activeTab, setActiveTab] = useState<'queue' | 'analytics' | 'audience' | 'health' | 'comments'>('queue');
    const [dateRange, setDateRange] = useState<7 | 30>(7);

    // Sync active tab with URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['queue', 'analytics', 'audience', 'health', 'comments'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    const handleTabChange = (tab: 'queue' | 'analytics' | 'audience' | 'health' | 'comments') => {
        setActiveTab(tab);
        router.push(`/admin?tab=${tab}`);
    };

    // Dashboard Data
    const [metrics, setMetrics] = useState({ 
        pendingCount: 0, 
        duplicatesCaughtToday: 0, 
        successfulInsertsToday: 0,
        uniqueVisitorsToday: 0,
        totalSubscribers: 0,
        payingSubscribers: 0,
        chartData: [] as {name: string, visitors: number}[],
        logs: [] as any[]
    });
    const [articles, setArticles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Global System Settings
    const [settings, setSettings] = useState({ ai_provider: 'aiml', cloudflare_daily_operations_cap: '30' });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [previewLogoPlacement, setPreviewLogoPlacement] = useState<'left' | 'center' | 'bar'>('center');

    // Comments Moderation State
    const [adminComments, setAdminComments] = useState<any[]>([]);
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editCommentContent, setEditCommentContent] = useState('');

    // Editor State
    const [selectedArticle, setSelectedArticle] = useState<any>(null);
    const [editForm, setEditForm] = useState({ title: "", excerpt: "", content_html: "" });

    // Handle Authentication Check
    const login = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        setIsLoading(true);

        try {
            const res = await fetch(`/api/admin/metrics?days=${dateRange}`, {
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
                document.cookie = `borg_admin_token=${passphrase}; path=/; max-age=31536000`;
                window.dispatchEvent(new Event('borg_admin_change'));
                
                fetchArticles(passphrase);
                fetchSettings(passphrase);
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
            document.cookie = `borg_admin_token=${token}; path=/; max-age=31536000`;
            fetch(`/api/admin/metrics?days=${dateRange}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.json() as any)
                .then(data => {
                    if (data.error) throw new Error();
                    setMetrics(data);
                    setIsAuthenticated(true);
                    window.dispatchEvent(new Event('borg_admin_change'));
                    fetchArticles(token);
                    fetchSettings(token);
                })
                .catch(() => {
                    localStorage.removeItem("borg_admin_token");
                    document.cookie = "borg_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                    window.dispatchEvent(new Event('borg_admin_change'));
                });
        }
        
        // Load local UI settings
        const storedLogo = localStorage.getItem('borg_logo_placement');
        if (storedLogo) setPreviewLogoPlacement(storedLogo as any);
    }, []);

    const handleLocalLogoChange = (placement: 'left' | 'center' | 'bar') => {
        setPreviewLogoPlacement(placement);
        localStorage.setItem('borg_logo_placement', placement);
        window.dispatchEvent(new Event('borg_logo_change'));
    };

    // Hook to allow refreshing metrics when the date segment changes
    useEffect(() => {
        if (!isAuthenticated || !passphrase) return;
        fetch(`/api/admin/metrics?days=${dateRange}`, { headers: { 'Authorization': `Bearer ${passphrase}` } })
            .then(res => res.json() as any)
            .then(data => {
                if (!data.error) setMetrics(data);
            });
    }, [dateRange]);

    const fetchArticles = async (token: string) => {
        const res = await fetch('/api/admin/articles', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data: any = await res.json();
            setArticles(data.articles || []);
        }
    };

    const fetchSettings = async (token: string) => {
        try {
            const res = await fetch('/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data: any = await res.json();
                if (data.settings) setSettings(data.settings);
            }
        } catch (e) {
            console.error("Failed to fetch settings", e);
        }
    };

    const fetchComments = async (token: string) => {
        try {
            const res = await fetch('/api/admin/comments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data: any = await res.json();
                setAdminComments(data.comments || []);
            }
        } catch (e) {
            console.error('Failed to fetch comments', e);
        }
    };

    const handleCommentAction = async (id: string, action: 'hide' | 'show' | 'delete', newContent?: string) => {
        try {
            if (action === 'delete') {
                await fetch('/api/admin/comments', {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${passphrase}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                setAdminComments(prev => prev.filter(c => c.id !== id));
            } else if (action === 'hide') {
                await fetch('/api/admin/comments', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${passphrase}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status: 'removed' })
                });
                setAdminComments(prev => prev.map(c => c.id === id ? { ...c, status: 'removed' } : c));
            } else if (action === 'show') {
                await fetch('/api/admin/comments', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${passphrase}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status: 'visible' })
                });
                setAdminComments(prev => prev.map(c => c.id === id ? { ...c, status: 'visible' } : c));
            }
        } catch (e) {
            console.error('Comment action failed', e);
        }
    };

    const handleCommentEdit = async (id: string) => {
        try {
            await fetch('/api/admin/comments', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${passphrase}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, content: editCommentContent })
            });
            setAdminComments(prev => prev.map(c => c.id === id ? { ...c, content: editCommentContent } : c));
            setEditingComment(null);
            setEditCommentContent('');
        } catch (e) {
            console.error('Comment edit failed', e);
        }
    };

    const handleSaveSettings = async (newProvider: string, newCap: string) => {
        setIsSavingSettings(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${passphrase}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ai_provider: newProvider,
                    cloudflare_daily_operations_cap: newCap
                })
            });
            if (res.ok) {
                setSettings({ ai_provider: newProvider, cloudflare_daily_operations_cap: newCap });
            } else {
                alert("Failed to save settings.");
            }
        } catch (e) {
            console.error("Setting save error", e);
        } finally {
            setIsSavingSettings(false);
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
            const metricsRes = await fetch(`/api/admin/metrics?days=${dateRange}`, { headers: { 'Authorization': `Bearer ${passphrase}` } });
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
                        onClick={() => handleTabChange('queue')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'queue' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <FileText className="w-5 h-5" /> Editorial Queue
                    </button>
                    <button 
                        onClick={() => handleTabChange('analytics')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <BarChart3 className="w-5 h-5" /> Web Analytics
                    </button>
                    <button 
                        onClick={() => handleTabChange('audience')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'audience' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <Users className="w-5 h-5" /> Audience CRM
                    </button>
                    <button 
                        onClick={() => handleTabChange('health')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'health' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <Activity className="w-5 h-5" /> System Health
                    </button>
                    <button 
                        onClick={() => { handleTabChange('comments'); fetchComments(passphrase); }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'comments' ? 'bg-blue-600 font-bold' : 'hover:bg-slate-800'}`}
                    >
                        <MessageSquare className="w-5 h-5" /> Comments
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button onClick={() => { 
                        localStorage.removeItem("borg_admin_token"); 
                        document.cookie = "borg_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                        window.dispatchEvent(new Event('borg_admin_change'));
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
                        <div className="flex justify-between items-end">
                            <h2 className="font-serif text-4xl font-black">Web Analytics</h2>
                        </div>
                        
                        {/* Traffic Overview */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Traffic Overview ({dateRange} Days)</h3>
                                
                                {/* Stitch-Style Segment Filter */}
                                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                                    <button 
                                        onClick={() => setDateRange(7)}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${dateRange === 7 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        7 Days
                                    </button>
                                    <button 
                                        onClick={() => setDateRange(30)}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${dateRange === 30 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        30 Days
                                    </button>
                                </div>
                            </div>
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

                {activeTab === 'health' && (
                    <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-end">
                            <h2 className="font-serif text-4xl font-black">System Health</h2>
                            <button 
                                onClick={() => login({ preventDefault: () => {} } as any)}
                                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-all"
                            >
                                <RefreshCcw className="w-4 h-4" /> Refresh Status
                            </button>
                        </div>

                        {/* Global AI Configuration */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-2">
                            <div className="p-5 bg-slate-50 border-b border-slate-200">
                                <h3 className="font-bold text-slate-800">Cost-Containment Protocol (Edge AI)</h3>
                                <p className="text-xs text-slate-500 mt-1">When active, the autonomous engine bypasses paid external models (Gemini/Perplexity) and relies exclusively on Cloudflare Workers AI for research, fact extraction, and article structuring. Set Daily Limit correctly to avoid free-tier charges.</p>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="flex flex-col gap-3">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Autonomous Core Provider</label>
                                    <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-xl">
                                        <button 
                                            onClick={() => handleSaveSettings('aiml', settings.cloudflare_daily_operations_cap)}
                                            disabled={isSavingSettings}
                                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${settings.ai_provider === 'aiml' ? 'bg-white shadow border border-slate-200 text-slate-900 border-b-2 border-b-blue-500' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Premium AIML (Gemini)
                                        </button>
                                        <button 
                                            onClick={() => handleSaveSettings('cloudflare', settings.cloudflare_daily_operations_cap)}
                                            disabled={isSavingSettings}
                                            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${settings.ai_provider === 'cloudflare' ? 'bg-white shadow border border-slate-200 text-slate-900 border-b-2 border-b-emerald-500' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            Edge Free (Llama 3)
                                        </button>
                                    </div>
                                    {settings.ai_provider === 'cloudflare' && (
                                        <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex gap-2">
                                            <ShieldCheck className="w-4 h-4 shrink-0" />
                                            <span><strong>Cost-Containment Active:</strong> The Feeder pipeline requires exactly $0 compute to maintain standard publication cadence. Utilizing Unsplash Public Image Fallbacks + Llama 3 for structure.</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-3">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Cloudflare Daily Ingestion Caps</label>
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1">
                                            <input 
                                                type="number"
                                                value={settings.cloudflare_daily_operations_cap}
                                                onChange={(e) => setSettings({...settings, cloudflare_daily_operations_cap: e.target.value})}
                                                className="w-full text-lg font-mono p-3 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:outline-none" 
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleSaveSettings(settings.ai_provider, settings.cloudflare_daily_operations_cap)}
                                            disabled={isSavingSettings}
                                            className="bg-slate-900 text-white font-bold text-sm px-6 py-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-50"
                                        >
                                            {isSavingSettings ? 'Saving...' : 'Update Limits'}
                                        </button>
                                    </div>
                                    <div className="mt-1">
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className={parseInt(settings.cloudflare_daily_operations_cap || '0') > 35 ? 'text-amber-600' : 'text-slate-500'}>
                                                Projected Cost vs Free Limit
                                            </span>
                                            <span className={parseInt(settings.cloudflare_daily_operations_cap || '0') > 43 ? 'text-red-500' : 'text-slate-500'}>
                                                {settings.cloudflare_daily_operations_cap} / 43 Max Safe Articles
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className={`h-2.5 rounded-full transition-all ${parseInt(settings.cloudflare_daily_operations_cap || '0') > 43 ? 'bg-red-500' : (parseInt(settings.cloudflare_daily_operations_cap || '0') > 35 ? 'bg-amber-400' : 'bg-emerald-500')}`}
                                                style={{ width: `${Math.min((parseInt(settings.cloudflare_daily_operations_cap || '0') / 43) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                        
                                        {parseInt(settings.cloudflare_daily_operations_cap || '0') > 43 ? (
                                            <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                OVERAGE WARNING: This setting exceeds the ~10,000 Neural Free Tier limit (Max ~43 articles/day). You may be billed!
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-500 mt-2">
                                                Max mathematical capacity per 24-hours before Cloudflare Llama-3 billing triggers is roughly 43 articles.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Brand UI Preview Settings */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-2">
                            <div className="p-5 bg-slate-50 border-b border-slate-200">
                                <h3 className="font-bold text-slate-800">Brand UI Preview (Local)</h3>
                                <p className="text-xs text-slate-500 mt-1">Live toggle the masthead logo placement to preview different layouts. This setting only applies to your local administrative session.</p>
                            </div>
                            <div className="p-6">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Logo Placement Option</label>
                                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-100 p-2 rounded-xl">
                                    <button 
                                        onClick={() => handleLocalLogoChange('left')}
                                        className={`flex-1 w-full py-3 px-4 rounded-lg text-sm font-bold transition-all ${previewLogoPlacement === 'left' ? 'bg-white shadow border border-slate-200 text-slate-900 border-b-2 border-b-blue-500' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        Option A (Left)
                                    </button>
                                    <button 
                                        onClick={() => handleLocalLogoChange('center')}
                                        className={`flex-1 w-full py-3 px-4 rounded-lg text-sm font-bold transition-all ${previewLogoPlacement === 'center' ? 'bg-white shadow border border-slate-200 text-slate-900 border-b-2 border-b-blue-500' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        Option B (Center Stack)
                                    </button>
                                    <button 
                                        onClick={() => handleLocalLogoChange('bar')}
                                        className={`flex-1 w-full py-3 px-4 rounded-lg text-sm font-bold transition-all ${previewLogoPlacement === 'bar' ? 'bg-white shadow border border-slate-200 text-slate-900 border-b-2 border-b-blue-500' : 'text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        Option C (Navy Bar)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Status Matrix */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                            {[
                                { name: 'Sentinel', status: 'Active', icon: ShieldCheck, color: 'emerald' },
                                { name: 'Scraper', status: 'Ready', icon: Activity, color: 'blue' },
                                { name: 'Ingest', status: metrics.logs.some(l => l.status.includes('error')) ? 'Degraded' : 'Active', icon: Zap, color: metrics.logs.some(l => l.status.includes('error')) ? 'orange' : 'emerald' },
                                { name: 'Discovery', status: 'Ready', icon: Users, color: 'blue' },
                            ].map((s) => (
                                <div key={s.name} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className={`p-3 rounded-xl bg-${s.color}-100 text-${s.color}-600`}>
                                        <s.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.name}</div>
                                        <div className={`text-sm font-black text-${s.color}-600 uppercase`}>{s.status}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Diagnostic Log */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700">Autonomous Diagnostic Log</h3>
                                <div className="flex gap-2">
                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Healthy
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div> Warning
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div> Critical
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px] border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4">Event Identity</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Message</th>
                                            <th className="px-6 py-4">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {metrics.logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                                                    No diagnostic records found in current orbit.
                                                </td>
                                            </tr>
                                        ) : (
                                            metrics.logs.map((log: any) => (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{log.event_slug}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                                                            log.status === 'inserted' || log.status === 'healthy' || log.status === 'healed' ? 'bg-emerald-100 text-emerald-700' :
                                                            log.status === 'auth_error' || log.status === 'quota_exceeded' ? 'bg-red-100 text-red-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 line-clamp-1 max-w-md">{log.message}</td>
                                                    <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">{formatTimeAgo(log.created_at)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'comments' && (
                    <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-end">
                            <h2 className="font-serif text-4xl font-black">Comment Moderation</h2>
                            <button 
                                onClick={() => fetchComments(passphrase)}
                                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-all"
                            >
                                <RefreshCcw className="w-4 h-4" /> Refresh
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-slate-400 uppercase text-[10px] font-bold tracking-wider mb-1">Total Comments</div>
                                <div className="text-3xl font-black">{adminComments.length}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-emerald-500 uppercase text-[10px] font-bold tracking-wider mb-1">Visible</div>
                                <div className="text-3xl font-black text-emerald-600">{adminComments.filter(c => c.status === 'visible').length}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-red-400 uppercase text-[10px] font-bold tracking-wider mb-1">Removed</div>
                                <div className="text-3xl font-black text-red-500">{adminComments.filter(c => c.status === 'removed').length}</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200">
                                <h3 className="font-bold text-slate-700">All Comments (Last 100)</h3>
                            </div>
                            {adminComments.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <MessageSquare className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                                    <p className="font-bold">No comments yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {adminComments.map((comment: any) => (
                                        <div key={comment.id} className={`p-5 flex gap-4 ${comment.status === 'removed' ? 'bg-red-50/50 opacity-60' : ''}`}>
                                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                                                {comment.display_name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-bold text-slate-800">{comment.display_name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">{comment.subscriber_email}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${comment.status === 'visible' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {comment.status}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mb-2 font-mono">
                                                    {comment.page_type}/{comment.page_slug} • {formatTimeAgo(comment.created_at)}
                                                </div>
                                                
                                                {editingComment === comment.id ? (
                                                    <div className="flex gap-2 mt-1">
                                                        <textarea 
                                                            value={editCommentContent}
                                                            onChange={(e) => setEditCommentContent(e.target.value)}
                                                            className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            rows={2}
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button 
                                                                onClick={() => handleCommentEdit(comment.id)}
                                                                className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700"
                                                            >Save</button>
                                                            <button 
                                                                onClick={() => { setEditingComment(null); setEditCommentContent(''); }}
                                                                className="text-slate-400 text-[10px] font-bold px-3 py-1.5 hover:text-slate-600"
                                                            >Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                                                )}
                                            </div>
                                            <div className="flex items-start gap-1 shrink-0">
                                                <button
                                                    onClick={() => { setEditingComment(comment.id); setEditCommentContent(comment.content); }}
                                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                {comment.status === 'visible' ? (
                                                    <button
                                                        onClick={() => handleCommentAction(comment.id, 'hide')}
                                                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-orange-600 transition-colors"
                                                        title="Hide comment"
                                                    >
                                                        <EyeOff className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCommentAction(comment.id, 'show')}
                                                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"
                                                        title="Restore comment"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { if (confirm('Permanently delete this comment?')) handleCommentAction(comment.id, 'delete'); }}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                    title="Delete permanently"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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

export default function AdminDashboard() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 min-w-full min-h-screen animate-pulse"><div className="w-16 h-16 border-4 border-t-slate-900 border-slate-200 rounded-full animate-spin"></div></div>}>
            <AdminDashboardContent />
        </Suspense>
    );
}
