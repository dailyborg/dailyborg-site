'use client';

import React from 'react';
import {
    ResponsiveContainer,
    RadialBarChart,
    RadialBar,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    AreaChart,
    Area,
    CartesianGrid,
    Cell,
    Legend
} from 'recharts';
import { Shield, TrendingUp, Award, AlertCircle } from 'lucide-react';

interface TrustworthinessChartProps {
    politicianName: string;
    trustworthinessScore: number | null;
    promisesKept: number;
    promisesBroken: number;
    promisesTotal: number;
    history: Array<{
        scored_at: string;
        score: number;
        promises_kept: number;
        promises_broken: number;
    }>;
}

function getScoreColor(score: number): string {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
}

function getScoreLabel(score: number): string {
    if (score >= 80) return 'Highly Trusted';
    if (score >= 60) return 'Mostly Trusted';
    if (score >= 40) return 'Mixed Record';
    return 'Low Trust';
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="bg-background border-2 border-foreground px-4 py-3 shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="text-sm font-bold" style={{ color: entry.color }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
};

export default function TrustworthinessChart({
    politicianName,
    trustworthinessScore,
    promisesKept,
    promisesBroken,
    promisesTotal,
    history
}: TrustworthinessChartProps) {
    const hasScore = trustworthinessScore !== null && trustworthinessScore !== undefined;
    const promisesInProgress = promisesTotal - promisesKept - promisesBroken;

    // Radial bar data
    const radialData = hasScore ? [
        { name: 'Trust', value: trustworthinessScore, fill: getScoreColor(trustworthinessScore!) }
    ] : [];

    // Promise breakdown data
    const promiseData = [
        { name: 'Kept', count: promisesKept, fill: '#10b981' },
        { name: 'Broken', count: promisesBroken, fill: '#ef4444' },
        { name: 'In Progress', count: Math.max(0, promisesInProgress), fill: '#6366f1' },
    ];

    // History data
    const historyData = history.map(h => ({
        date: new Date(h.scored_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        score: h.score,
        kept: h.promises_kept,
        broken: h.promises_broken,
    }));

    return (
        <div className="w-full space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3 border-b-[3px] border-foreground pb-3">
                <Shield className="w-6 h-6 text-accent" />
                <h2 className="font-serif text-3xl md:text-4xl font-black uppercase tracking-tighter">
                    Trustworthiness Index
                </h2>
            </div>

            {!hasScore && promisesTotal === 0 ? (
                <div className="p-8 border border-border bg-muted/10 text-center">
                    <AlertCircle className="w-10 h-10 text-muted-foreground mb-4 mx-auto opacity-50" />
                    <p className="text-muted-foreground font-serif italic text-lg">
                        Accountability scoring is currently active. Data will appear as background workers complete verification.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Radial Score */}
                    <div className="border border-border p-6 flex flex-col items-center justify-center bg-background">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Overall Trust</p>
                        {hasScore ? (
                            <>
                                <div className="w-40 h-40 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadialBarChart
                                            cx="50%"
                                            cy="50%"
                                            innerRadius="70%"
                                            outerRadius="100%"
                                            startAngle={180}
                                            endAngle={0}
                                            data={radialData}
                                            barSize={14}
                                        >
                                            <RadialBar
                                                dataKey="value"
                                                cornerRadius={4}
                                                background={{ fill: 'hsl(var(--muted))' }}
                                            />
                                        </RadialBarChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-serif font-black" style={{ color: getScoreColor(trustworthinessScore!) }}>
                                            {trustworthinessScore}
                                        </span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">/100</span>
                                    </div>
                                </div>
                                <p className="text-xs font-bold uppercase tracking-widest mt-2" style={{ color: getScoreColor(trustworthinessScore!) }}>
                                    {getScoreLabel(trustworthinessScore!)}
                                </p>
                            </>
                        ) : (
                            <div className="w-40 h-40 flex items-center justify-center">
                                <span className="text-2xl font-serif italic text-muted-foreground">Scoring…</span>
                            </div>
                        )}
                    </div>

                    {/* Promise Breakdown */}
                    <div className="border border-border p-6 bg-background">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                            <Award className="w-3.5 h-3.5" /> Promise Tracker
                        </p>
                        {promisesTotal > 0 ? (
                            <>
                                <div className="h-40">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={promiseData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                axisLine={false}
                                                tickLine={false}
                                                width={75}
                                                tick={{ fontSize: 11, fontWeight: 700 }}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                                                {promiseData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2 border-t border-border pt-2">
                                    <span>Total Tracked: {promisesTotal}</span>
                                    <span>Keep Rate: {promisesTotal > 0 ? Math.round((promisesKept / promisesTotal) * 100) : 0}%</span>
                                </div>
                            </>
                        ) : (
                            <div className="h-40 flex items-center justify-center">
                                <span className="text-sm font-serif italic text-muted-foreground">No promises tracked yet</span>
                            </div>
                        )}
                    </div>

                    {/* Trust Trend Over Time */}
                    <div className="border border-border p-6 bg-background">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5" /> Trust Trend
                        </p>
                        {historyData.length > 1 ? (
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={historyData} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10, fontWeight: 600 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            name="Trust Score"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            fill="url(#trustGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-40 flex items-center justify-center">
                                <span className="text-sm font-serif italic text-muted-foreground">Trend data building…</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
