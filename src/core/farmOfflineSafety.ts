import type { GameState } from './types';
import { farmCropDefOrNull } from './registry';
import { farmOf } from './farmBusiness';
import { farmGrowthReadyAt } from './farmRotation';

export interface FarmSessionResumeResult {
  awayMs: number;
  rescuedWithered: number;
}

/**
 * Farm Empire is an active-session game: crops and the farm clock pause while
 * the desktop app is closed. The one-time rescue lets pre-v20 farms recover
 * crops that the former wall-clock behavior spoiled between play sessions.
 */
export function resumeFarmSession(
  state: GameState,
  previousSavedAt: number,
  now: number,
  rescueLegacyWithered: boolean,
): FarmSessionResumeResult {
  const safeNow = Number.isFinite(now) ? now : 0;
  const safeSavedAt = Number.isFinite(previousSavedAt) && previousSavedAt > 0
    ? Math.min(previousSavedAt, safeNow)
    : safeNow;
  const awayMs = Math.max(0, safeNow - safeSavedAt);
  let rescuedWithered = 0;

  for (const plot of state.plots) {
    const crop = plot.crop;
    if (!crop || !Number.isFinite(crop.plantedAt)) continue;
    const def = farmCropDefOrNull(crop.defId);
    if (!def) continue;
    crop.wateredBonusMs = Number.isFinite(crop.wateredBonusMs) ? Math.max(0, crop.wateredBonusMs) : 0;
    crop.plantedAt += awayMs;
    if (Number.isFinite(crop.lastWateredAt) && crop.lastWateredAt > 0) crop.lastWateredAt += awayMs;

    const readyAt = farmGrowthReadyAt(crop);
    if (rescueLegacyWithered && crop.awaitingWater !== true && safeNow >= readyAt + def.witherMs) {
      crop.plantedAt = safeNow - def.growMs + crop.wateredBonusMs + (crop.rotationBonusMs ?? 0);
      if (crop.lastWateredAt > safeNow) crop.lastWateredAt = safeNow;
      rescuedWithered += 1;
    }
  }

  farmOf(state).clock.lastRealAt = safeNow;
  return { awayMs, rescuedWithered };
}
