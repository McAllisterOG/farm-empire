import type { GameEvent } from '../core/types';
import { farmCropDef } from '../core/registry';
import { formatMoney } from '../core/farmBusiness';
import { toast } from './toast';

/** Aggregate sales have a batch event target, not a crop registry entry. */
export function showFarmSaleFeedback(event: GameEvent): void {
  const description = event.target === 'batch' ? 'produce items' : farmCropDef(String(event.target)).name;
  toast(`Sold ${event.amount ?? 0} ${description} for ${formatMoney(Number(event.data ?? 0))}.`, 'good');
}
