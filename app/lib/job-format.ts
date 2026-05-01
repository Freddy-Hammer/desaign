export function isRemote(location: string | null): boolean {
  if (!location) return false;
  return /\bremote\b|\bworldwide\b|\banywhere\b/i.test(location);
}

export function formatPosted(iso: string | null): string {
  if (!iso) return "Recently posted";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently posted";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}
