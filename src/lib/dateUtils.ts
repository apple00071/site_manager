/**
 * Date and Time Utilities for IST (Indian Standard Time)
 * Formats dates and times consistently across the application
 */

/**
 * Format date to DD/MM/YYYY in IST
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string (e.g., "25/12/2024")
 */
export function formatDateIST(dateString: string | Date): string {
  const date = new Date(dateString);
  
  // Convert to IST (UTC+5:30)
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  const day = String(istDate.getDate()).padStart(2, '0');
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const year = istDate.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Format time to 12-hour format with AM/PM in IST
 * @param dateString - ISO date string or Date object
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTimeIST(dateString: string | Date): string {
  const date = new Date(dateString);
  
  // Convert to IST (UTC+5:30)
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date and time together in IST
 * @param dateString - ISO date string or Date object
 * @returns Formatted date and time string (e.g., "25/12/2024, 2:30 PM")
 */
export function formatDateTimeIST(dateString: string | Date): string {
  return `${formatDateIST(dateString)}, ${formatTimeIST(dateString)}`;
}

/**
 * Format date in a more readable format (e.g., "2 Nov, 2025")
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string
 */
export function formatDateReadable(dateString: string | Date): string {
  const date = new Date(dateString);
  
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date and time in readable format
 * @param dateString - ISO date string or Date object
 * @returns Formatted string (e.g., "2 Nov, 2025 at 2:30 PM")
 */
export function formatDateTimeReadable(dateString: string | Date): string {
  return `${formatDateReadable(dateString)} at ${formatTimeIST(dateString)}`;
}

/**
 * Get relative time (e.g., "2 hours ago", "3 days ago")
 * @param dateString - ISO date string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return formatDateReadable(dateString);
}

/**
 * Convert date to IST ISO string for API calls
 * @param date - Date object
 * @returns ISO string in IST
 */
export function toISTISOString(date: Date): string {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return istDate.toISOString();
}

/**
 * Get current date in YYYY-MM-DD format for date inputs
 * @returns Date string for input[type="date"]
 */
export function getTodayDateString(): string {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

