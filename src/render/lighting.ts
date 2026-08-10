/** Shared lighting curve for an explicit game-clock or real-world hour. */
export function nightAlphaAtHour(hour: number): number {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized >= 7 && normalized <= 17) return 0;
  if (normalized > 17 && normalized < 20) return ((normalized - 17) / 3) * 0.42;
  if (normalized >= 20 || normalized < 5) return 0.42;
  return (1 - (normalized - 5) / 2) * 0.42;
}

export function farmNightAlpha(clockMinute: number): number {
  return nightAlphaAtHour(clockMinute / 60);
}
