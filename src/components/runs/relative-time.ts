const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, nowMs: number = Date.now()) {
	const then = new Date(iso).getTime();
	const seconds = Math.max(1, Math.round((nowMs - then) / 1000));
	if (seconds < MINUTE) return `${seconds}s ago`;
	if (seconds < HOUR) return `${Math.round(seconds / MINUTE)}m ago`;
	if (seconds < DAY) return `${Math.round(seconds / HOUR)}h ago`;
	return `${Math.round(seconds / DAY)}d ago`;
}
