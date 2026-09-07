import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import "../src/data";
import { createFarmGame } from "../src/core/state";
import {
  farmOf,
  plantFarmCrop,
  tillFarmField,
  waterFarmCrop,
  purchaseNeighborParcel,
  purchaseBarnLoftExpansion,
  purchaseCountyGrainSilo,
  restoreOldTractor,
  purchaseCountyRowCropFieldKit,
  purchaseCountyUtilityTrailer,
  purchaseCountyHarvestWagon,
  syncCashMirror,
} from "../src/core/farmBusiness";
import {
  hireFirstFarmhand,
  hireFarmManager,
  hireEliotReyes,
} from "../src/core/farmWorkforce";
import { purchaseFarmsteadOfficeQuarters } from "../src/core/farmstead";
import { purchaseRoadsideStand } from "../src/core/farmRoadsideStand";
import { allFarmCrops } from "../src/core/registry";
import { deserialize, serialize, exportSave } from "../src/save/save";
import { farmWeatherForDay } from "../src/core/farmWeather";

describe("Astra synthetic acceptance fixtures", () => {
  it("roundtrips a dense upgraded v26 farm with all eight crop identities and cargo", () => {
    const now = Date.UTC(2026, 8, 6, 12);
    let seed = 1;
    while (farmWeatherForDay(seed, 1).kind !== "clear") seed++;
    const state = createFarmGame("Astra Dense QA", seed, now),
      farm = farmOf(state);
    // Explicit synthetic funds and completed gates are fixture setup, never gameplay.
    farm.cashCents = 10_000_000;
    farm.townContact.status = "completed";
    farm.countyFreight.lastCompletedDay = 1;
    for (const action of [
      purchaseNeighborParcel,
      purchaseBarnLoftExpansion,
      purchaseCountyGrainSilo,
      restoreOldTractor,
      purchaseCountyRowCropFieldKit,
      purchaseCountyUtilityTrailer,
      purchaseCountyHarvestWagon,
      hireFirstFarmhand,
      hireFarmManager,
      purchaseFarmsteadOfficeQuarters,
      hireEliotReyes,
      purchaseRoadsideStand,
    ])
      expect(action(state).ok, action.name).toBe(true);
    const crops = allFarmCrops();
    crops.forEach((c) => {
      farm.seeds[c.id] = 180;
      farm.storage[c.id] = 24;
    });
    state.plots.forEach((p, i) => {
      const crop = crops[i % crops.length],
        time = now - crop.growMs - 1000;
      expect(tillFarmField(state, p.uid).ok).toBe(true);
      expect(plantFarmCrop(state, p.uid, crop.id, time, "manual").ok).toBe(
        true,
      );
      expect(waterFarmCrop(state, p.uid, time + 1).ok).toBe(true);
    });
    farm.pickup.cargo.crops = {
      crop_corn: 20,
      crop_carrot: 10,
      crop_tomato: 10,
    };
    farm.pickup.cargo.seeds = { crop_wheat: 6 };
    farm.equipment.harvestWagon.crops = { crop_wheat: 100, crop_pumpkin: 20 };
    syncCashMirror(state);
    const encoded = serialize(state, now),
      loaded = deserialize(encoded, now);
    expect(loaded.version).toBe(26);
    expect(loaded.plots).toHaveLength(132);
    expect(loaded.farm?.pickup.cargo).toEqual(farm.pickup.cargo);
    expect(loaded.farm?.equipment.harvestWagon).toEqual(
      farm.equipment.harvestWagon,
    );
    expect(new Set(loaded.plots.map((p) => p.crop?.defId)).size).toBe(8);
    if (process.env.ASTRA_WRITE_FIXTURES === "1") {
      const dir = resolve("release/astra-qa");
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, "dense-v26.json"), serialize(loaded, now));
      writeFileSync(resolve(dir, "dense-v26.txt"), exportSave(loaded, now));
      const starter = createFarmGame("Astra Starter QA", seed, now);
      writeFileSync(resolve(dir, "starter-v26.txt"), exportSave(starter, now));
      writeFileSync(resolve(dir, "starter-v26.json"), serialize(starter, now));
    }
  });
});
