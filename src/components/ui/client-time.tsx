import { formatFullTimestamp } from "@/lib/utils";

interface ClientTimeProps {
  timestamp: string | Date;
  fallback?: string;
}

/**
 * Renders a stored publish date in Eastern Time.
 *
 * This runs on the server. formatFullTimestamp pins the zone to America/New_York,
 * so the markup the server sends and the markup the browser keeps are identical
 * and there is nothing to wait for on the client.
 */
export function ClientTime({ timestamp, fallback }: ClientTimeProps) {
  const value = typeof timestamp === "string" ? timestamp : timestamp.toISOString();
  const formatted = formatFullTimestamp(value);

  if (!formatted) {
    return <span>{fallback || "Date unavailable"}</span>;
  }

  return <span>{formatted}</span>;
}
