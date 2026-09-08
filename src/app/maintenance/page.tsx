import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
    title: "We will be back shortly",
    description: "The Daily Borg is briefly offline for maintenance.",
    robots: { index: false, follow: false },
};

export default function MaintenancePage() {
    return (
        <div className="min-h-screen bg-[#FDF9F3] text-zinc-900 flex flex-col md:flex-row relative overflow-hidden">

            {/* Left/Top Content: The Message */}
            <div className="w-full md:w-1/2 min-h-[50vh] md:min-h-screen flex flex-col justify-center items-center md:items-start p-8 md:p-24 z-10 relative">
                <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 font-sans font-semibold tracking-wider text-xs uppercase mb-8 border border-amber-600/30 shadow-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                        </span>
                        Maintenance
                    </div>

                    <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                        We will be <br className="hidden md:block" /> back shortly.
                    </h1>

                    <p className="font-sans text-lg md:text-xl text-zinc-700 mb-8 leading-relaxed max-w-md">
                        The Daily Borg is offline for a short while so we can work on it. Nothing is lost,
                        and the newsroom picks up where it left off as soon as we are done. Try again in a
                        few minutes.
                    </p>

                    <p className="font-sans text-sm text-zinc-600 uppercase tracking-widest font-semibold">
                        Questions: pressroom@dailyborg.com
                    </p>
                </div>
            </div>

            {/* Right/Bottom Content: The Art */}
            <div className="w-full md:w-1/2 h-[50vh] md:h-screen relative flex items-center justify-center p-8 md:p-0">
                {/* Decorative architectural grid background overlay */}
                <div className="absolute inset-0 bg-[#e5e5f7] opacity-[0.2] bg-[radial-gradient(#444cf7_1px,transparent_1px)] [background-size:16px_16px]"></div>

                <div className="relative w-full max-w-[800px] h-full z-10 drop-shadow-2xl">
                    <Image
                        src="/images/maintenance/bg.png"
                        alt=""
                        aria-hidden="true"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
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
