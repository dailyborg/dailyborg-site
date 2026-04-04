import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateString: string) {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (isNaN(diff)) return "Just now";
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'JUST IN';
    if (minutes < 60) return `${minutes}m AGO`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h AGO`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d AGO`;
    
    // User local date formatting
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

export function formatFullTimestamp(dateString: string) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    
    // Using undefined as the first argument uses the browser's default locale
    return date.toLocaleString(undefined, options).toUpperCase().replace(',', ' •');
}
