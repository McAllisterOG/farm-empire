import { COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY } from '../data/townWorkOrders.data';
import type { ActionResult, GameState } from './types';
import { fail } from './types';
import { farmOf, syncCashMirror } from './farmBusiness';
import { pickupCropUnits } from './farmPickup';
import { recordFarmStat } from './farmKnowledge';

export interface CountyKitchenContext { pickupPresent: boolean; source: 'pickup'; }
export function countyKitchenProgress(state: GameState, context?: CountyKitchenContext): Record<'crop_corn' | 'crop_carrots' | 'crop_tomatoes', number> {
  const present = context?.source === 'pickup' && context.pickupPresent;
  return { crop_corn: present ? pickupCropUnits(state, 'crop_corn') : 0, crop_carrots: present ? pickupCropUnits(state, 'crop_carrots') : 0, crop_tomatoes: present ? pickupCropUnits(state, 'crop_tomatoes') : 0 };
}
export function offerCountyKitchenDelivery(state: GameState): ActionResult {
  const kitchen = farmOf(state).countyKitchen;
  if (farmOf(state).townContact.status !== 'completed') return fail('Complete the County Pantry delivery before speaking with Rosa.');
  if (kitchen.status === 'unmet') kitchen.status = 'offered';
  return { ok: true };
}
export function acceptCountyKitchenDelivery(state: GameState): ActionResult {
  const kitchen = farmOf(state).countyKitchen;
  if (farmOf(state).townContact.status !== 'completed') return fail('Complete the County Pantry delivery first.');
  if (kitchen.status === 'completed') return fail('The Garden Table Delivery is already complete.');
  if (kitchen.status === 'unmet') return fail('Speak with Rosa Alvarez at the County Pantry & Kitchen first.');
  if (kitchen.status === 'offered') kitchen.status = 'active';
  return { ok: true, events: [{ type: 'toast', target: 'Garden Table Delivery accepted. Load Rosa’s exact produce list into the pickup.' }] };
}
export function fulfillCountyKitchenDelivery(state: GameState, context?: CountyKitchenContext): ActionResult {
  const farm = farmOf(state); const kitchen = farm.countyKitchen;
  if (kitchen.status !== 'active') return fail('There is no active Garden Table Delivery.');
  if (!context || context.source !== 'pickup' || !context.pickupPresent) return fail('Bring the old pickup to County Pantry & Kitchen before delivery.');
  const progress = countyKitchenProgress(state, context); const cargo = COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.cargo;
  if (progress.crop_corn < cargo.crop_corn || progress.crop_carrots < cargo.crop_carrots || progress.crop_tomatoes < cargo.crop_tomatoes) return fail('Load the exact Garden Table produce list into the pickup before delivery.');
  kitchen.status = 'completed';
  farm.pickup.cargo.crops.crop_corn = progress.crop_corn - cargo.crop_corn;
  farm.pickup.cargo.crops.crop_carrots = progress.crop_carrots - cargo.crop_carrots;
  farm.pickup.cargo.crops.crop_tomatoes = progress.crop_tomatoes - cargo.crop_tomatoes;
  farm.cashCents += COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents;
  recordFarmStat(state, 'farmDeliveries'); recordFarmStat(state, 'itemsSold', 18); recordFarmStat(state, 'farmCashEarnedCents', COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents); syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'Garden Table Delivery served. $115.00 received.' }] };
}
