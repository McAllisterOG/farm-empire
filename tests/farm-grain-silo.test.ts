import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_GRAIN_SILO } from '../src/data/farmEquipment.data';
import { farmOf, purchaseCountyGrainSilo } from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { unloadHandBasket } from '../src/core/farmHarvestBasket';

const NOW = Date.UTC(2026, 7, 13, 12);
const farm = () => createFarmGame('Silo Test', 1616, NOW);

function unlockSilo(state: ReturnType<typeof farm>): void {
  const business = farmOf(state);
  business.parcels.northOwned = true;
  business.equipment.barnLoftExpansionOwned = true;
  business.storageCapacity = COUNTY_GRAIN_SILO.fromCapacity;
}

describe('County Grain Silo', () => {
  it('uses the commercial 1,200-unit capacity', () => {
    expect(COUNTY_GRAIN_SILO.toCapacity).toBe(1_200);
  });
  it('starts closed and requires the acreage plus barn loft', () => {
    const state = farm(); const business = farmOf(state);
    expect(SAVE_VERSION).toBe(25);
    expect(business.equipment.countyGrainSiloOwned).toBe(false);
    const initial = JSON.stringify(business);
    expect(purchaseCountyGrainSilo(state).ok).toBe(false);
    expect(JSON.stringify(business)).toBe(initial);
    business.parcels.northOwned = true;
    expect(purchaseCountyGrainSilo(state).ok).toBe(false);
    business.equipment.barnLoftExpansionOwned = true;
    business.cashCents = COUNTY_GRAIN_SILO.priceCents;
    expect(purchaseCountyGrainSilo(state).ok).toBe(true);
  });

  it('purchases atomically once with exact capacity, accounting, and cash mirror', () => {
    const state = farm(); const business = farmOf(state); unlockSilo(state);
    business.cashCents = COUNTY_GRAIN_SILO.priceCents - 1;
    const short = JSON.stringify({ business, stats: state.stats });
    expect(purchaseCountyGrainSilo(state).ok).toBe(false);
    expect(JSON.stringify({ business, stats: state.stats })).toBe(short);

    business.cashCents = COUNTY_GRAIN_SILO.priceCents;
    expect(purchaseCountyGrainSilo(state).ok).toBe(true);
    expect(business.equipment.countyGrainSiloOwned).toBe(true);
    expect(business.storageCapacity).toBe(COUNTY_GRAIN_SILO.toCapacity);
    expect(business.cashCents).toBe(0);
    expect(state.player.coins).toBe(0);
    expect(state.stats.farmCashSpentCents).toBe(COUNTY_GRAIN_SILO.priceCents);
    const owned = JSON.stringify({ business, stats: state.stats });
    expect(purchaseCountyGrainSilo(state).ok).toBe(false);
    expect(JSON.stringify({ business, stats: state.stats })).toBe(owned);
  });

  it('migrates v15 closed and derives capacity from valid ownership only', () => {
    const old = farm() as unknown as Record<string, any>;
    old.version = 15;
    old.farm.parcels.northOwned = true;
    old.farm.equipment.barnLoftExpansionOwned = true;
    old.farm.equipment.countyGrainSiloOwned = true;
    old.farm.storageCapacity = 9_999;
    const migrated = deserialize(JSON.stringify(old), NOW + 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).equipment.countyGrainSiloOwned).toBe(false);
    expect(farmOf(migrated).storageCapacity).toBe(COUNTY_GRAIN_SILO.fromCapacity);

    const corrupt = farm() as unknown as Record<string, any>;
    corrupt.farm.parcels.northOwned = true;
    corrupt.farm.equipment.barnLoftExpansionOwned = true;
    corrupt.farm.equipment.countyGrainSiloOwned = 'yes';
    corrupt.farm.storageCapacity = COUNTY_GRAIN_SILO.toCapacity;
    const closed = deserialize(JSON.stringify(corrupt), NOW + 2);
    expect(farmOf(closed).equipment.countyGrainSiloOwned).toBe(false);
    expect(farmOf(closed).storageCapacity).toBe(COUNTY_GRAIN_SILO.fromCapacity);
  });

  it('round-trips ownership at 1,200 but keeps non-silo normalization at 480 or 720', () => {
    const owned = farm(); unlockSilo(owned);
    farmOf(owned).equipment.countyGrainSiloOwned = true;
    farmOf(owned).storageCapacity = COUNTY_GRAIN_SILO.toCapacity;
    const reloaded = deserialize(serialize(owned, NOW + 3), NOW + 4);
    expect(farmOf(reloaded).equipment.countyGrainSiloOwned).toBe(true);
    expect(farmOf(reloaded).storageCapacity).toBe(COUNTY_GRAIN_SILO.toCapacity);

    const impossible = farm();
    farmOf(impossible).equipment.countyGrainSiloOwned = true;
    farmOf(impossible).storageCapacity = COUNTY_GRAIN_SILO.toCapacity;
    const safe = deserialize(serialize(impossible, NOW + 5), NOW + 6);
    expect(farmOf(safe).equipment.countyGrainSiloOwned).toBe(false);
    expect(farmOf(safe).storageCapacity).toBe(480);

    const loftOnly = farm();
    farmOf(loftOnly).parcels.northOwned = true;
    farmOf(loftOnly).equipment.barnLoftExpansionOwned = true;
    farmOf(loftOnly).storageCapacity = COUNTY_GRAIN_SILO.toCapacity;
    expect(farmOf(deserialize(serialize(loftOnly, NOW + 7), NOW + 8)).storageCapacity).toBe(720);
  });

  it('rescues a v19 old-capacity barn without touching stored crops or the hand basket', () => {
    const stranded = farm() as unknown as Record<string, any>;
    stranded.version = 19;
    stranded.farm.storageCapacity = 150;
    stranded.farm.storage.crop_corn = 144;
    stranded.farm.handBasket = { crops: { crop_corn: 18 }, destination: 'barn' };
    const loaded = deserialize(JSON.stringify(stranded), NOW + 9);
    expect(farmOf(loaded).storageCapacity).toBe(480);
    expect(farmOf(loaded).storage.crop_corn).toBe(144);
    expect(farmOf(loaded).handBasket).toEqual({ crops: { crop_corn: 18 }, destination: 'barn' });
    expect(unloadHandBasket(loaded, 'barn').ok).toBe(true);
    expect(farmOf(loaded).storage.crop_corn).toBe(162);
    expect(farmOf(loaded).handBasket.crops).toEqual({});

    stranded.farm.parcels.northOwned = true;
    stranded.farm.equipment.barnLoftExpansionOwned = true;
    stranded.farm.storageCapacity = 200;
    expect(farmOf(deserialize(JSON.stringify(stranded), NOW + 10)).storageCapacity).toBe(720);
  });
});
