import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** SQLite writes "YYYY-MM-DD HH:MM:SS" with no zone; treat it as UTC so every machine agrees. */
function parseDbDate(dateString: string): Date {
    let safeString = dateString.toString();
    if (!safeString.endsWith("Z") && safeString.includes(" ")) {
        safeString = safeString.replace(" ", "T") + "Z";
    }
    return new Date(safeString);
}

export function formatTimeAgo(dateString: string) {
    if (!dateString) return "Just now";
    const date = parseDbDate(dateString);
    const diff = Date.now() - date.getTime();
    if (isNaN(diff)) return "Just now";

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "JUST IN";
    if (minutes < 60) return `${minutes}m AGO`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h AGO`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d AGO`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).toUpperCase();
}

export function formatFullTimestamp(dateString: string) {
    if (!dateString) return "";
    const date = parseDbDate(dateString);
    if (isNaN(date.getTime())) return "";
    const options: Intl.DateTimeFormatOptions = {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York",
    };
    return date.toLocaleString("en-US", options).toUpperCase().replace(",", " •") + " ET";
}

/** Edition label in Eastern Time, so the server and the browser agree. */
export function currentEditionName(date: Date = new Date()): string {
    const hour = parseInt(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(date), 10);
    if (hour >= 5 && hour < 12) return "Morning Borg Edition";
    if (hour >= 12 && hour < 17) return "Afternoon Borg Edition";
    if (hour >= 17 && hour < 21) return "Evening Borg Edition";
    return "Nightly Borg Edition";
}
