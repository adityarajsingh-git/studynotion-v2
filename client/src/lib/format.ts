/**
 * Human-readable course length. Rounding straight to hours turned anything
 * under 30 minutes into "0h", so sub-hour totals stay in minutes.
 */
export function formatDuration(totalMin: number): string {
  if (!Number.isFinite(totalMin) || totalMin <= 0) return "0m";
  if (totalMin < 60) return `${Math.round(totalMin)}m`;

  const hours = Math.floor(totalMin / 60);
  const mins = Math.round(totalMin % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/** Total runtime of a lesson list, in minutes. */
export function totalMinutes(lessons: { durationMin: number }[]): number {
  return lessons.reduce((sum, l) => sum + (l.durationMin || 0), 0);
}
