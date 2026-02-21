/**
 * Time formatting utility for displaying relative time
 */

/**
 * Format epoch timestamp as relative time (e.g., "2h ago", "3d ago")
 * @param epoch - Unix timestamp in seconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(epoch: number): string {
  const now = Date.now();
  const seconds = Math.floor((now - epoch * 1000) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}