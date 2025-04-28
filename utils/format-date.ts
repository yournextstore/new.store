export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  // Just now: less than a minute ago
  if (diffInSeconds < 60) {
    return "just now"
  }

  // Minutes: less than an hour ago
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
  }

  // Hours: less than a day ago
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  }

  // Check if it's today (same day)
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return "today"
  }

  // Check if it's yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  if (isYesterday) {
    return "yesterday"
  }

  // Check if it's within the last week
  if (diffInSeconds < 604800) {
    // 7 days
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} ${days === 1 ? "day" : "days"} ago`
  }

  // Check if it's this year
  const isThisYear = date.getFullYear() === now.getFullYear()
  if (isThisYear) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  // Default: return formatted date for older dates
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

/**
 * Formats a date into a standard format for display
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
