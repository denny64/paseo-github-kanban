// No imports: the test runs this file directly under Node's type stripping.

// Compact age for list rows: "now", "5m", "3h", "12d", then a short date.
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const clock = (date: Date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// When a scheduled run starts: "2:00 am today", "9:00 am tomorrow", "Tue 2:00 am".
export function runAtLabel(iso: string, now = Date.now()): string {
  const at = new Date(iso);
  const days = Math.round((dayStart(at) - dayStart(new Date(now))) / 86_400_000);
  if (days === 0) return `${clock(at)} today`;
  if (days === 1) return `${clock(at)} tomorrow`;
  return `${at.toLocaleDateString(undefined, { weekday: "short" })} ${clock(at)}`;
}

// Choices for "When": relative ones, then the next 11 pm, 2 am and 9 am that
// are at least 15 minutes away.
export function schedulePresets(now = Date.now()): { label: string; at: string }[] {
  const relative = [1, 3].map((hours) => ({
    label: `In ${hours} ${hours === 1 ? "hour" : "hours"}`,
    at: new Date(now + hours * 3_600_000).toISOString(),
  }));
  const fixed = [23, 2, 9]
    .map((hour) => {
      const at = new Date(now);
      at.setHours(hour, 0, 0, 0);
      if (at.getTime() < now + 15 * 60_000) at.setDate(at.getDate() + 1);
      return at.toISOString();
    })
    .sort()
    .map((at) => ({ label: runAtLabel(at, now), at }));
  return [...relative, ...fixed];
}
