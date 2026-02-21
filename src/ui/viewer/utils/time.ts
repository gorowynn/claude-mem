/**
 * Time formatting utility for displaying relative time
 */

/**
 * Format epoch timestamp as relative time (e.g., "2h ago", "3d ago")
 * @param epoch - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(epoch: number): string {
  const now = Date.now();
  const diff = now - epoch;

  // Define time units in milliseconds
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  // Calculate the appropriate unit
  if (diff < minute) {
    const seconds = Math.floor(diff / 1000);
    return `${seconds}s ago`;
  }

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m ago`;
  }

  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  }

  if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days}d ago`;
  }

  if (diff < month) {
    const weeks = Math.floor(diff / week);
    return `${weeks}w ago`;
  }

  if (diff < year) {
    const months = Math.floor(diff / month);
    return `${months}mo ago`;
  }

  const years = Math.floor(diff / year);
  return `${years}y ago`;
}