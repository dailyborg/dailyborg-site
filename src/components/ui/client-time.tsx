"use client";

import { useEffect, useState } from "react";

interface ClientTimeProps {
  timestamp: string | Date;
  fallback?: string;
}

export function ClientTime({ timestamp, fallback }: ClientTimeProps) {
  const [mounted, setMounted] = useState(false);
  const [formattedDate, setFormattedDate] = useState("");
  const [formattedTime, setFormattedTime] = useState("");

  useEffect(() => {
    setMounted(true);
    
    // SQLite sometimes outputs "YYYY-MM-DD HH:MM:SS" without the Z.
    // We forcibly parse it as UTC to stop JS from guessing the timezone.
    let safeString = timestamp.toString();
    if (!safeString.endsWith('Z') && safeString.includes(' ')) {
        safeString = safeString.replace(' ', 'T') + 'Z';
    }
    
    const date = new Date(safeString);
    
    // Check if the date is valid before trying to format it
    if (isNaN(date.getTime())) {
      setFormattedDate("");
      setFormattedTime("");
      return;
    }

    setFormattedDate(
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      }).toUpperCase()
    );
    setFormattedTime(
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/New_York",
      }).toUpperCase() + " ET"
    );
  }, [timestamp]);

  if (!mounted) {
    if (fallback) {
      return <span>{fallback}</span>;
    }
    return <span className="opacity-0">Loading...</span>;
  }

  // If the date was invalid
  if (!formattedDate) {
    return <span>Unknown Date</span>;
  }

  return (
    <>
      <span>{formattedDate}</span>
      <span>•</span>
      <span>{formattedTime}</span>
    </>
  );
}
