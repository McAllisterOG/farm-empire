import type { GameState } from './types';
import { farmOf, waterFarmCrop } from './farmBusiness';
import { hashSeed, mulberry32 } from './rng';

export type FarmWeatherKind = 'clear' | 'cloudy' | 'rain';

export interface FarmWeather {
  kind: FarmWeatherKind;
  label: string;
  shortForecast: string;
  fieldNote: string;
}

export interface FarmWeatherForecastDay extends FarmWeather {
  day: number;
}

const WEATHER_COPY: Readonly<Record<FarmWeatherKind, Omit<FarmWeather, 'kind'>>> = {
  clear: {
    label: 'Clear skies',
    shortForecast: 'Clear',
    fieldNote: 'Good working weather. New plantings still need establishment water.',
  },
  cloudy: {
    label: 'Cloudy',
    shortForecast: 'Cloudy',
    fieldNote: 'Cool, overcast fieldwork. New plantings still need establishment water.',
  },
  rain: {
    label: 'Steady rain',
    shortForecast: 'Rain',
    fieldNote: 'Rain establishes any new planting that is waiting for its first water.',
  },
};

export function farmWeatherForDay(seed: number, day: number): FarmWeather {
  const safeDay = Math.max(1, Math.floor(day));
  const roll = mulberry32(hashSeed(`${Math.floor(seed)}:farm-weather:${safeDay}`))();
  const kind: FarmWeatherKind = roll < .22 ? 'rain' : roll < .52 ? 'cloudy' : 'clear';
  return { kind, ...WEATHER_COPY[kind] };
}

export function currentFarmWeather(state: GameState): FarmWeatherForecastDay {
  const day = farmOf(state).clock.day;
  return { day, ...farmWeatherForDay(state.seed, day) };
}

export function farmWeatherForecast(state: GameState, count = 3): FarmWeatherForecastDay[] {
  const firstDay = farmOf(state).clock.day;
  const safeCount = Math.max(1, Math.min(7, Math.floor(count)));
  return Array.from({ length: safeCount }, (_, index) => {
    const day = firstDay + index;
    return { day, ...farmWeatherForDay(state.seed, day) };
  });
}

export interface FarmRainResult {
  weather: FarmWeatherKind;
  wateredPlotUids: number[];
}

/**
 * Applies only the existing one-time establishment watering transaction.
 * Calling this repeatedly is safe because an established crop is no longer eligible.
 */
export function applyCurrentFarmRain(state: GameState, now: number): FarmRainResult {
  const weather = currentFarmWeather(state).kind;
  if (weather !== 'rain') return { weather, wateredPlotUids: [] };
  const eligible = state.plots
    .filter((plot) => plot.crop?.awaitingWater === true)
    .map((plot) => plot.uid)
    .sort((a, b) => a - b);
  const wateredPlotUids: number[] = [];
  for (const plotUid of eligible) {
    if (waterFarmCrop(state, plotUid, now).ok) wateredPlotUids.push(plotUid);
  }
  return { weather, wateredPlotUids };
}
