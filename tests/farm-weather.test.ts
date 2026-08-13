import { describe, expect, it } from 'vitest';
import '../src/data';
import { farmOf, plantFarmCrop, tillFarmField } from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { applyCurrentFarmRain, currentFarmWeather, farmWeatherForDay, farmWeatherForecast, type FarmWeatherKind } from '../src/core/farmWeather';
import { deserialize, serialize } from '../src/save/save';

const NOW = 1_784_550_000_000;

function makeFarm() { return createFarmGame('Weather Farm', 404, NOW); }

function firstDayWith(seed: number, kind: FarmWeatherKind): number {
  for (let day = 1; day <= 200; day++) if (farmWeatherForDay(seed, day).kind === kind) return day;
  throw new Error(`No ${kind} day found`);
}

describe('deterministic County weather', () => {
  it('derives stable clear, cloudy, and rainy days from only the saved seed and day', () => {
    const first = Array.from({ length: 90 }, (_, index) => farmWeatherForDay(404, index + 1).kind);
    const replay = Array.from({ length: 90 }, (_, index) => farmWeatherForDay(404, index + 1).kind);
    expect(replay).toEqual(first);
    expect(new Set(first)).toEqual(new Set<FarmWeatherKind>(['clear', 'cloudy', 'rain']));
    expect(farmWeatherForDay(404, 0)).toEqual(farmWeatherForDay(404, 1));
  });

  it('returns a bounded consecutive forecast without mutating farm state', () => {
    const state = makeFarm();
    farmOf(state).clock.day = 17;
    const before = JSON.stringify(state);
    const forecast = farmWeatherForecast(state, 3);
    expect(forecast.map((item) => item.day)).toEqual([17, 18, 19]);
    expect(forecast[0]).toEqual(currentFarmWeather(state));
    expect(farmWeatherForecast(state, 99)).toHaveLength(7);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('rain establishment watering', () => {
  it('uses the existing one-time watering transaction in stable plot order', () => {
    const state = makeFarm(); const farm = farmOf(state);
    farm.clock.day = firstDayWith(state.seed, 'rain');
    const first = state.plots[0]; const second = state.plots[1];
    farm.seeds.crop_wheat = 2;
    expect(tillFarmField(state, first.uid).ok).toBe(true);
    expect(tillFarmField(state, second.uid).ok).toBe(true);
    expect(plantFarmCrop(state, first.uid, 'crop_wheat', NOW, 'manual').ok).toBe(true);
    expect(plantFarmCrop(state, second.uid, 'crop_wheat', NOW, 'manual').ok).toBe(true);
    state.plots.reverse();

    const result = applyCurrentFarmRain(state, NOW + 12_000);
    expect(result.weather).toBe('rain');
    expect(result.wateredPlotUids).toEqual([first.uid, second.uid].sort((a, b) => a - b));
    expect(first.crop).toMatchObject({ awaitingWater: false, plantedAt: NOW + 12_000, lastWateredAt: NOW + 12_000 });
    expect(second.crop).toMatchObject({ awaitingWater: false, plantedAt: NOW + 12_000, lastWateredAt: NOW + 12_000 });
    expect(state.stats.farmSectionsWatered).toBe(2);
    const established = JSON.stringify(state);
    expect(applyCurrentFarmRain(state, NOW + 13_000).wateredPlotUids).toEqual([]);
    expect(JSON.stringify(state)).toBe(established);
  });

  it('does nothing in dry weather and never changes already-established crops', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    farm.clock.day = firstDayWith(state.seed, 'clear');
    farm.seeds.crop_corn = 1;
    expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'manual').ok).toBe(true);
    const drySnapshot = JSON.stringify(state);
    expect(applyCurrentFarmRain(state, NOW + 1_000)).toEqual({ weather: 'clear', wateredPlotUids: [] });
    expect(JSON.stringify(state)).toBe(drySnapshot);

    farm.clock.day = firstDayWith(state.seed, 'rain');
    plot.crop!.awaitingWater = false;
    plot.crop!.lastWateredAt = NOW;
    const establishedSnapshot = JSON.stringify(state);
    expect(applyCurrentFarmRain(state, NOW + 2_000).wateredPlotUids).toEqual([]);
    expect(JSON.stringify(state)).toBe(establishedSnapshot);
  });

  it('requires no save field or migration and replays the same forecast after reload', () => {
    const state = makeFarm();
    farmOf(state).clock.day = 23;
    const before = farmWeatherForecast(state);
    const raw = serialize(state, NOW + 1);
    expect(JSON.parse(raw).version).toBe(SAVE_VERSION);
    expect(JSON.parse(raw).farm.weather).toBeUndefined();
    const loaded = deserialize(raw, NOW + 2);
    expect(farmWeatherForecast(loaded)).toEqual(before);
  });
});
