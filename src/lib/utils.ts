import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatTimeAgo(dateString: string) {
    if (!dateString) return "Just now";
    
    // SQLite sometimes outputs "YYYY-MM-DD HH:MM:SS" without the Z.
    // We forcibly parse it as UTC to stop JS from guessing the timezone incorrectly.
    let safeString = dateString.toString();
    if (!safeString.endsWith('Z') && safeString.includes(' ')) {
        safeString = safeString.replace(' ', 'T') + 'Z';
    }

    const date = new Date(safeString);
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
    
    // Use Eastern Time for strict consistency
    return date.toLocaleDateString("en-US", { month: 'short', day: 'numeric', timeZone: "America/New_York" }).toUpperCase();
}

export function formatFullTimestamp(dateString: string) {
    if (!dateString) return "";
    let safeString = dateString.toString();
    if (!safeString.endsWith('Z') && safeString.includes(' ')) {
        safeString = safeString.replace(' ', 'T') + 'Z';
    }

    const date = new Date(safeString);
    if (isNaN(date.getTime())) return "";
    
    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: "America/New_York"
    };
    
    // Force Eastern Time and add the ET indicator
    return date.toLocaleString("en-US", options).toUpperCase().replace(',', ' •') + " ET";
}
