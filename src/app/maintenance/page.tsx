"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function MaintenancePage() {
    // 30 Days from March 10, 2026 -> April 9, 2026
    const TARGET_DATE = new Date("2026-04-09T12:00:00Z").getTime();

    const [timeLeft, setTimeLeft] = useState({
        days: 30,
        hours: 0,
        minutes: 0,
        seconds: 0
    });
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const difference = TARGET_DATE - now;

            if (difference <= 0) {
                clearInterval(timer);
                return;
            }

            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((difference % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [TARGET_DATE]);

    return (
        <div className="min-h-screen bg-[#FDF9F3] text-zinc-900 flex flex-col md:flex-row relative overflow-hidden">

            {/* Left/Top Content: The Message */}
            <div className="w-full md:w-1/2 min-h-[50vh] md:min-h-screen flex flex-col justify-center items-center md:items-start p-8 md:p-24 z-10 relative">
                <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 font-sans font-semibold tracking-wider text-xs uppercase mb-8 border border-amber-500/20 shadow-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        System Expansion Underway
                    </div>

                    <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                        The Grid is <br className="hidden md:block" /> Expanding.
                    </h1>

                    <p className="font-sans text-lg md:text-xl text-zinc-600 mb-12 leading-relaxed max-w-md">
                        Our intelligence engine is currently offline for structural reinforcement. The Daily Borg is constructing the next generation of uncompromised truth matrices.
                    </p>

                    {/* Countdown Timer */}
                    {isMounted && (
                        <div className="grid grid-cols-4 gap-4 md:gap-6 bg-white p-6 rounded-2xl shadow-xl shadow-amber-900/5 ring-1 ring-zinc-200/50 backdrop-blur-sm max-w-[24rem]">
                            <div className="flex flex-col items-center">
                                <span className="font-serif text-3xl md:text-4xl font-bold text-zinc-900">{timeLeft.days}</span>
                                <span className="font-sans text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1">Days</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="font-serif text-3xl md:text-4xl font-bold text-zinc-900">{timeLeft.hours.toString().padStart(2, '0')}</span>
                                <span className="font-sans text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1">Hours</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="font-serif text-3xl md:text-4xl font-bold text-zinc-900">{timeLeft.minutes.toString().padStart(2, '0')}</span>
                                <span className="font-sans text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1">Mins</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="font-serif text-3xl md:text-4xl font-bold text-amber-600 animate-pulse">{timeLeft.seconds.toString().padStart(2, '0')}</span>
                                <span className="font-sans text-[10px] md:text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1">Secs</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right/Bottom Content: The Art */}
            <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative flex items-center justify-center p-8 md:p-0">
                {/* Decorative architectural grid background overlay */}
                <div className="absolute inset-0 bg-[#e5e5f7] opacity-[0.2] bg-[radial-gradient(#444cf7_1px,transparent_1px)] [background-size:16px_16px]"></div>

                <div className="relative w-full max-w-[800px] h-full transform hover:scale-105 transition-transform duration-1000 ease-out z-10 drop-shadow-2xl">
                    <Image
                        src="/images/maintenance/bg.png"
                        alt="3D isometric construction site building a newspaper"
                        fill
                        className="object-contain drop-shadow-2xl"
                        priority
                    />
                </div>

                {/* Aesthetic Gradient Fades */}
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#FDF9F3] to-transparent z-20 hidden md:block pointer-events-none"></div>
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#FDF9F3] to-transparent z-20 block md:hidden pointer-events-none"></div>
            </div>

        </div>
    );
}
