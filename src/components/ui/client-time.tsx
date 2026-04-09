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
    const date = new Date(timestamp);
    
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
      }).toUpperCase()
    );
    setFormattedTime(
      date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).toUpperCase()
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
