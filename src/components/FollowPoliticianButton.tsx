'use client';

import { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';

export default function FollowPoliticianButton({ politicianId, initialPinned = false }: { politicianId: string, initialPinned?: boolean }) {
    const [isFollowing, setIsFollowing] = useState(false);
    const [isPinned, setIsPinned] = useState(initialPinned);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('tracked_politicians');
            if (saved) {
                const parsed = JSON.parse(saved);
                const match = parsed.find((p: any) => p.id === politicianId);
                if (match) {
                    setIsFollowing(true);
                    setIsPinned(match.pinned || false);
                }
            }
        } catch(e) {}
    }, [politicianId]);

    const saveState = (following: boolean, pinned: boolean) => {
        try {
            const saved = localStorage.getItem('tracked_politicians');
            let parsed = saved ? JSON.parse(saved) : [];
            parsed = parsed.filter((p: any) => p.id !== politicianId);
            if (following) {
                parsed.push({ id: politicianId, pinned });
            }
            localStorage.setItem('tracked_politicians', JSON.stringify(parsed));
            // Dispatch a custom event to notify other components without full refresh
            window.dispatchEvent(new Event('borg_tracked_officials_update'));
        } catch(e) {}
    };

    const handleFollowToggle = async () => {
        const newFollowing = !isFollowing;
        setIsFollowing(newFollowing);
        saveState(newFollowing, isPinned);
    };

    const handlePinToggle = async () => {
        const newPinned = !isPinned;
        setIsPinned(newPinned);
        if (isFollowing) {
             saveState(true, newPinned);
        }
    };

    return (
        <div className="flex flex-col gap-2 mt-6">
            <button 
                onClick={handleFollowToggle}
                className={`flex items-center gap-2 px-6 py-3 font-black text-sm uppercase tracking-widest transition-all ${
                    isFollowing 
                    ? 'bg-accent/10 text-accent border-2 border-accent' 
                    : 'bg-foreground text-background hover:bg-foreground/80'
                }`}
            >
                {isFollowing ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                {isFollowing ? 'Tracking Enabled' : 'Track Official'}
            </button>
            
            {isFollowing && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-colors p-2 bg-muted/20 border border-border/50">
                    <input 
                        type="checkbox" 
                        checked={isPinned} 
                        onChange={handlePinToggle}
                        className="accent-foreground w-4 h-4"
                    />
                    Always show this first in my Borg Record dashboard
                </label>
            )}
        </div>
    );
}
