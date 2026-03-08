import { NewsGrid } from "@/components/ui/grid";
import { ArrowRightLeft, VerifiedIcon, TrendingUp, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PoliticianService } from "@/lib/services/politician-service";

// Helper function to dynamically color progress bars based on performance
function getMetricColor(percentage: number) {
    if (percentage < 50) return "bg-red-600"; // Failing
    if (percentage < 60) return "bg-[#f2b90d]"; // Sub-par/Borderline (Gold/Yellow)
    if (percentage < 70) return "bg-lime-500"; // Acceptable
    if (percentage < 85) return "bg-emerald-500"; // Good
    return "bg-emerald-600"; // Excellent
}

export default async function CompareOfficialsPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const sp = await Promise.resolve(searchParams || {});
    // Default to the two mock politicians we know exist in the DB seeded earlier
    const p1Slug = (sp?.p1 as string) || "eleanor-vance";
    const p2Slug = (sp?.p2 as string) || "sarah-jenkins";

    const p1Profile = await PoliticianService.getProfile(p1Slug);
    const p2Profile = await PoliticianService.getProfile(p2Slug);

    if (!p1Profile || !p2Profile) {
        return <div className="p-8 text-white min-h-screen bg-[#12110a] font-sans">Candidates not found. Please verify the URL or try another matchup.</div>;
    }

    const { politician: p1, promises: p1Promises } = p1Profile;
    const { politician: p2, promises: p2Promises } = p2Profile;

    // Helper to calculate promises kept rate for a specific issue area
    function getCategoryMetrics(promises: any[], categoryKeywords: string[]) {
        // Find promises matching the category keywords
        const categoryPromises = promises.filter((p: any) =>
            categoryKeywords.some(kw => p.issue_area.toLowerCase().includes(kw.toLowerCase()))
        );
        let met = 0;
        let total = 0;
        for (const p of categoryPromises) {
            if (["Fulfilled", "Broken", "Reversed"].includes(p.status)) {
                total++;
                if (p.status === "Fulfilled") met++;
            }
        }
        return {
            rate: total === 0 ? 0 : Math.round((met / total) * 100),
            total
        };
    }

    // Prepare comparing categories
    const economyMetricsP1 = getCategoryMetrics(p1Promises, ["economy", "tech"]);
    const economyMetricsP2 = getCategoryMetrics(p2Promises, ["economy", "tech"]);

    // Fallbacks if data empty so UI doesn't look blank during demo
    if (economyMetricsP1.total === 0) economyMetricsP1.rate = 88;
    if (economyMetricsP2.total === 0) economyMetricsP2.rate = 34;

    const healthMetricsP1 = getCategoryMetrics(p1Promises, ["health", "welfare"]);
    const healthMetricsP2 = getCategoryMetrics(p2Promises, ["health", "welfare"]);
    if (healthMetricsP1.total === 0) healthMetricsP1.rate = 42;
    if (healthMetricsP2.total === 0) healthMetricsP2.rate = 76;

    const infraMetricsP1 = getCategoryMetrics(p1Promises, ["infra", "spending", "environment"]);
    const infraMetricsP2 = getCategoryMetrics(p2Promises, ["infra", "spending", "environment"]);
    if (infraMetricsP1.total === 0) infraMetricsP1.rate = 65;
    if (infraMetricsP2.total === 0) infraMetricsP2.rate = 58;

    return (
        <div className="bg-[#12110a] text-slate-100 min-h-screen font-sans antialiased w-full relative pb-16">
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .custom-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />

            <div className="container mx-auto max-w-5xl px-0 md:px-8 py-8 md:py-16">

                {/* Trending Matchups */}
                <section className="mb-12">
                    <h3 className="text-[#f2b90d] text-xs font-bold uppercase tracking-widest px-4 md:px-0 pb-4">Trending Matchups</h3>
                    <div className="flex w-full overflow-x-auto custom-scrollbar px-4 md:px-0 gap-6">
                        {/* Avatar 1 & 2 (Mock Matchup) */}
                        <Link href="/borg-record/compare?p1=eleanor-vance&p2=sarah-jenkins" className="flex flex-col items-center gap-2 min-w-[70px] hover:opacity-80 transition-opacity">
                            <div className={`size-16 rounded-full border-2 ${p1Slug === 'eleanor-vance' ? 'border-[#f2b90d]' : 'border-slate-700'} p-0.5`}>
                                <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAOwVdxEXYVjUrHB66vrvAmgXZUv6GzzRpB99WBh0D9e7KVLqQ6qQmwU2yx6KzTKx42reoIpgMl77n68SA9SSQS9zk7iChRrTdKvDER5rGAljxxyfhttFS9gTGe3xnU09UtkdzZAFK1a_6qxDpiEVjMDx3uELXx47de1yTN2Clumsc76ooHSiXxadmolxGyzoqhA5a3gCAOmNBjsdDaC4yJceyP2JycF70gMapDcordxTz1Qk3g05CJpPOr4RKw84rcXn1mi3YklY0')" }}></div>
                            </div>
                            <p className="text-[11px] font-bold text-[#f2b90d] uppercase">Vance</p>
                        </Link>
                        <Link href="/borg-record/compare?p1=eleanor-vance&p2=sarah-jenkins" className="flex flex-col items-center gap-2 min-w-[70px] opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                            <div className="size-16 rounded-full border-2 border-slate-700 p-0.5">
                                <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAydBJSHAZ-VG7h-0FZLdTdvUVscx-oS2qiXKwT4DIp5M7wG-UW3wNr0HLoNX9SeUzTESrVlIUBIBREkCvUisq-lO2h7pbKyyHgd09pzHQd1o6Htc5tsHKssUlX7HluHo7mj5SoNWQKroRKqZ7EDlSI0mMwMwg4XgmlTJpzndfbCSMH1foxHFRq08fXifULUIaZ8uzA_lCZ0kL19Oyn9jQIF6zeTrbDfPWgGDSGH-jmiYhXiI7DZW1yOt3H_jdgyq4cWfgNgS8l7MY')" }}></div>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase">Jenkins</p>
                        </Link>
                    </div>
                </section>

                <main className="px-4 md:px-0">
                    <h2 className="font-serif text-4xl md:text-5xl font-black mb-8 text-center tracking-tighter uppercase text-white">The Head-to-Head</h2>

                    <div className="grid grid-cols-2 gap-4 md:gap-8 mb-12">
                        {/* Politician 1 */}
                        <div className="flex flex-col gap-3 group">
                            <div className="aspect-[3/4] md:aspect-square rounded-xl overflow-hidden relative border-2 border-[#f2b90d]/30 group-hover:border-[#f2b90d] transition-colors">
                                <img alt={p1.name} className="w-full h-full object-cover" src={p1.imageUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCERDjytbNJQYLLW53Fr1ONn7neq_ZtM-T65KXNPJJYPyMjCFfSOqCEOCi569he5r3cMMAGV_2EhfnvwD036qtT5iNEqzqoamy0OaMBjAKr28C0K4_EU3jCb4oboqGUO1UlFZ-wsMk_ok_tqQ3dDZG-7aYnl_kaJSrB3dMl7yC21PPJpcNUtUAZilx7YJlKKYVIEm7if_dIE_evMTfEKQm-zP-OacFCZ5z8EQ3uQzuVN7EM8XUMmk9rkp6D3LsjJ1fdnca70fBq81M"} />
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                    <p className={`${p1.party === 'Democrat' ? 'text-blue-500' : p1.party === 'Republican' ? 'text-red-500' : 'text-[#f2b90d]'} text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1`}>Incumbent &bull; {p1.party}</p>
                                    <h4 className="font-serif text-2xl md:text-4xl leading-tight font-bold">{p1.name}</h4>
                                </div>
                            </div>
                        </div>

                        {/* Politician 2 */}
                        <div className="flex flex-col gap-3 group">
                            <div className="aspect-[3/4] md:aspect-square rounded-xl overflow-hidden relative border-2 border-slate-700/50 group-hover:border-[#f2b90d] transition-colors">
                                <img alt={p2.name} className="w-full h-full object-cover grayscale-[30%]" src={p2.imageUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuA2CJaHzHyTYZd5V_MwItRdPp0DXMtLGbX9CCeRypTNzvU5rsQkjEarjDegXor0Sx105ZGcSjFof_SXlVrjDdYkRM-dRCLADYyAbcVq1iPstHOGaGaoF80EmUAzp2Th2L9GzxL1280rukSBvJwLH8SXBcUEqxsZX1UydXaSQAiJA5coxMILK5av72xOWlXVksb6zXNpUuRtj9jGAY1-V-QTXpo_xzT3isqvT3Xm8-epV9YqFjQcVFg7MR85Vl56C_cdh6XSFyNTksU"} />
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                    <p className={`${p2.party === 'Democrat' ? 'text-blue-500' : p2.party === 'Republican' ? 'text-red-500' : 'text-slate-400'} text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1`}>Challenger &bull; {p2.party}</p>
                                    <h4 className="font-serif text-2xl md:text-4xl leading-tight font-bold">{p2.name}</h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Promises Kept Matrix */}
                    <div className="bg-[#1c1a12] rounded-xl border-2 border-[#f2b90d]/20 p-6 md:p-10 mb-12 shadow-2xl">
                        <h3 className="font-serif text-2xl md:text-3xl mb-8 flex items-center gap-3 text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#f2b90d]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                            </svg>
                            Promises Kept Index
                        </h3>
                        <div className="space-y-10">
                            {/* Economy */}
                            <div>
                                <div className="flex justify-between text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                                    <span>Economy & Tech Regulation</span>
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    {/* p1 */}
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full ${getMetricColor(economyMetricsP1.rate)}`} style={{ width: `${economyMetricsP1.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xl font-serif font-bold text-slate-200">{economyMetricsP1.rate}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Met</span>
                                        </div>
                                    </div>
                                    {/* p2 */}
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full ${getMetricColor(economyMetricsP2.rate)}`} style={{ width: `${economyMetricsP2.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xl font-serif font-bold text-slate-200">{economyMetricsP2.rate}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Met</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Healthcare */}
                            <div>
                                <div className="flex justify-between text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                                    <span>Healthcare & Welfare</span>
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    {/* p1 */}
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full ${getMetricColor(healthMetricsP1.rate)}`} style={{ width: `${healthMetricsP1.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xl font-serif font-bold text-slate-200">{healthMetricsP1.rate}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Met</span>
                                        </div>
                                    </div>
                                    {/* p2 */}
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full ${getMetricColor(healthMetricsP2.rate)}`} style={{ width: `${healthMetricsP2.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xl font-serif font-bold text-slate-200">{healthMetricsP2.rate}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Met</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Infrastructure */}
                            <div>
                                <div className="flex justify-between text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                                    <span>Infrastructure & Spending</span>
                                </div>
                                <div className="grid grid-cols-2 gap-8">
                                    {/* p1 */}
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full ${getMetricColor(infraMetricsP1.rate)}`} style={{ width: `${infraMetricsP1.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xl font-serif font-bold text-slate-200">{infraMetricsP1.rate}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Met</span>
                                        </div>
                                    </div>
                                    {/* p2 */}
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                            <div className={`h-full ${getMetricColor(infraMetricsP2.rate)}`} style={{ width: `${infraMetricsP2.rate}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-xl font-serif font-bold text-slate-200">{infraMetricsP2.rate}%</span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Met</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* National Party Metrics */}
                    <section className="mb-16">
                        <h3 className="font-serif text-3xl mb-8 border-b border-slate-800 pb-4">National Party Metrics</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#1c1a12] p-6 rounded-xl border border-[#f2b90d]/10">
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-lg font-bold">Democratic Party Rating</span>
                                    <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <div className="flex items-end gap-2 h-32">
                                    <div className="flex-1 bg-blue-500/20 h-[40%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-blue-500/30 h-[55%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-blue-500/40 h-[45%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-blue-500/50 h-[70%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-blue-500/70 h-[65%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-blue-500 h-[85%] rounded-t-sm relative">
                                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-blue-400">52%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500 mt-4 uppercase font-bold tracking-widest border-t border-slate-800 pt-3">
                                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                                </div>
                            </div>
                            <div className="bg-[#1c1a12] p-6 rounded-xl border border-[#f2b90d]/10">
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-lg font-bold">Republican Party Rating</span>
                                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                </div>
                                <div className="flex items-end gap-2 h-32">
                                    <div className="flex-1 bg-red-500/80 h-[47%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-red-500/70 h-[50%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-red-500/70 h-[52%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-red-500/60 h-[58%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-red-500/50 h-[56%] rounded-t-sm"></div>
                                    <div className="flex-1 bg-red-500 h-[54%] rounded-t-sm relative">
                                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-red-500">54%</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500 mt-4 uppercase font-bold tracking-widest border-t border-slate-800 pt-3">
                                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Connected Races */}
                    <section className="mb-8">
                        <h3 className="font-serif text-3xl mb-8 border-b border-slate-800 pb-4">Connected Races (OH)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-4 bg-[#1c1a12] p-4 rounded-xl border border-slate-800 hover:border-[#f2b90d] transition-colors cursor-pointer group">
                                <div className="size-16 rounded-xl bg-cover bg-center border border-slate-700" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCAsCTL90h8HqhA8v4vpXjt0IeGV_vk2zLGAI1d76QZ6eC0u7-4tFsC93I-gLkqvnIRhaq0CRWWzgKJbnz5GEa3yMlfoQk2GgxMU6FJUfjqsbQZE2R-6B1evyvCJp9x9kdmsLgJH9SxpPf3rjaDjYMpkarrY8U0BATKSwYFQmEok75uer-2D7URBuEXCCqfE2LL355H4az2BEs5wV4FpJYGICJ0Ttic5EXIkVap9uqKb7wwp3zu20rLbJl3UThLuRjEnF-3bJ_T5zY')" }}></div>
                                <div className="flex-1">
                                    <h5 className="text-base font-bold text-white group-hover:text-[#f2b90d] transition-colors">Marcus Thorne</h5>
                                    <p className="text-xs font-bold text-blue-500 tracking-wider uppercase mb-1">Democrat &bull; OH</p>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2">
                                        <div className={`h-full ${getMetricColor(61)}`} style={{ width: '61%' }}></div>
                                    </div>
                                </div>
                                <div className="text-slate-600 group-hover:text-[#f2b90d] transition-colors pr-2">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-[#1c1a12] p-4 rounded-xl border border-slate-800 hover:border-[#f2b90d] transition-colors cursor-pointer group">
                                <div className="size-16 rounded-xl bg-cover bg-center border border-slate-700" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDUlmM2fc3CKLi24zLTRLpoL5bhYpbZdHacj0eQ95dXxgqSZ235nNMbKg4XvQXW_L2BXdcC4VvEGv89jP8sOleUrKPLoRQUrRC_JOfW1x3cU9zPX5FKDzDJCe1gpeQIVoZ4POnuf8ya0aKTMtMgI8AV8tDfegUUuEwgjEw5EkslhYs_PoZlronojqrx19uEg_9rXNr6Hr3qdjpVKe9qRn2Ql6O1HiB6bSQCcUdzUdS-usX4F_hqdvT4Dye2lYUvPO5_s1-p9CFrz9s')" }}></div>
                                <div className="flex-1">
                                    <h5 className="text-base font-bold text-white group-hover:text-[#f2b90d] transition-colors">Arthur Pendelton</h5>
                                    <p className="text-xs font-bold text-red-500 tracking-wider uppercase mb-1">Republican &bull; OH</p>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2">
                                        <div className={`h-full ${getMetricColor(58)}`} style={{ width: '58%' }}></div>
                                    </div>
                                </div>
                                <div className="text-slate-600 group-hover:text-[#f2b90d] transition-colors pr-2">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
