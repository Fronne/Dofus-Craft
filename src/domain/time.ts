const relativeTimeFormatter = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

export function formatRelativeTime(value: string, now: Date = new Date()): string {
  const diffSeconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 1) return relativeTimeFormatter.format(diffSeconds, 'second');
  if (Math.abs(diffHours) < 1) return relativeTimeFormatter.format(diffMinutes, 'minute');
  if (Math.abs(diffDays) < 1) return relativeTimeFormatter.format(diffHours, 'hour');
  return relativeTimeFormatter.format(diffDays, 'day');
}
