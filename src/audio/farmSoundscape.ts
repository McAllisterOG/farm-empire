import type { ManualFieldActionKind } from '../core/farmManualAction';
import type { FarmWeatherKind } from '../core/farmWeather';
import { setSound, setSoundVolume, sfx, sharedAudioContext } from './sound';

export const FARM_AUDIO_SETTINGS_KEY = 'farm-empire:audio:v1';

export interface FarmAudioSettings {
  muted: boolean;
  ambience: number;
  effects: number;
}

export interface FarmAudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_FARM_AUDIO_SETTINGS: Readonly<FarmAudioSettings> = {
  muted: false,
  ambience: .34,
  effects: .58,
};

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function normalizeFarmAudioSettings(value: unknown): FarmAudioSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_FARM_AUDIO_SETTINGS };
  const raw = value as Partial<FarmAudioSettings>;
  return {
    muted: typeof raw.muted === 'boolean' ? raw.muted : DEFAULT_FARM_AUDIO_SETTINGS.muted,
    ambience: volume(raw.ambience, DEFAULT_FARM_AUDIO_SETTINGS.ambience),
    effects: volume(raw.effects, DEFAULT_FARM_AUDIO_SETTINGS.effects),
  };
}

export function readFarmAudioSettings(storage: FarmAudioStorage | null): FarmAudioSettings {
  if (!storage) return { ...DEFAULT_FARM_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(FARM_AUDIO_SETTINGS_KEY);
    return raw ? normalizeFarmAudioSettings(JSON.parse(raw)) : { ...DEFAULT_FARM_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_FARM_AUDIO_SETTINGS };
  }
}

export function writeFarmAudioSettings(storage: FarmAudioStorage | null, settings: FarmAudioSettings): void {
  if (!storage) return;
  try {
    storage.setItem(FARM_AUDIO_SETTINGS_KEY, JSON.stringify(normalizeFarmAudioSettings(settings)));
  } catch {
    // Audio preferences are optional and must never block gameplay.
  }
}

export interface FarmSoundscapeSnapshot extends FarmAudioSettings {
  started: boolean;
  vehicle: 'tractor' | 'pickup' | null;
  vehicleMoving: boolean;
  weather: FarmWeatherKind;
}

export class FarmSoundscape {
  private settings: FarmAudioSettings;
  private ac: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private vehicle: 'tractor' | 'pickup' | null = null;
  private vehicleMoving = false;
  private weather: FarmWeatherKind = 'clear';

  constructor(private readonly storage: FarmAudioStorage | null) {
    this.settings = readFarmAudioSettings(storage);
    this.syncLegacyEffects();
  }

  snapshot(): FarmSoundscapeSnapshot {
    return { ...this.settings, started: !!this.ac, vehicle: this.vehicle, vehicleMoving: this.vehicleMoving, weather: this.weather };
  }

  updateSettings(next: Partial<FarmAudioSettings>): FarmAudioSettings {
    this.settings = normalizeFarmAudioSettings({ ...this.settings, ...next });
    writeFarmAudioSettings(this.storage, this.settings);
    this.syncLegacyEffects();
    this.applyMix();
    return { ...this.settings };
  }

  ensureStarted(): void {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return;
    }
    try {
      const ac = sharedAudioContext();
      if (!ac) return;
      this.ac = ac;
      this.createWind(ac);
      this.createEngine(ac);
      this.applyMix();
    } catch {
      // Unsupported or blocked audio must never prevent the farm from loading.
      this.destroy();
    }
  }

  playManualAction(kind: ManualFieldActionKind): void {
    this.ensureStarted();
    if (kind === 'plant') sfx('plant');
    else if (kind === 'water') sfx('water');
    else if (kind === 'harvest') sfx('harvest');
    else sfx('build');
  }

  playTransaction(kind: 'sell' | 'expand' | 'success' | 'error' | 'scout'): void {
    this.ensureStarted();
    if (kind === 'sell') sfx('coin');
    else if (kind === 'expand') sfx('quest');
    else if (kind === 'error') sfx('error');
    else if (kind === 'scout') sfx('happy');
    else sfx('click');
  }

  update(vehicle: 'tractor' | 'pickup' | null, vehicleMoving: boolean, weather: FarmWeatherKind = 'clear'): void {
    this.vehicle = vehicle;
    this.vehicleMoving = vehicleMoving;
    this.weather = weather;
    if (!this.ac) return;
    this.applyMix();
    const ac = this.ac;
    const effects = this.settings.muted ? 0 : this.settings.effects;
    const engineLevel = !vehicle ? 0 : (vehicleMoving ? .052 : .018) * effects;
    this.engineGain?.gain.setTargetAtTime(engineLevel, ac.currentTime, .08);
    this.engineOsc?.frequency.setTargetAtTime(vehicle === 'pickup' ? (vehicleMoving ? 82 : 59) : (vehicleMoving ? 66 : 47), ac.currentTime, .09);

  }

  destroy(): void {
    try { this.windSource?.stop(); } catch { /* already stopped */ }
    try { this.engineOsc?.stop(); } catch { /* already stopped */ }
    this.windSource = null;
    this.engineOsc = null;
    this.ambientGain?.disconnect();
    this.ambientFilter?.disconnect();
    this.engineGain?.disconnect();
    this.ambientGain = null;
    this.ambientFilter = null;
    this.engineGain = null;
    this.ac = null;
  }

  private syncLegacyEffects(): void {
    setSound(!this.settings.muted && this.settings.effects > 0);
    setSoundVolume(this.settings.muted ? 0 : this.settings.effects);
  }

  private applyMix(): void {
    if (!this.ac || !this.ambientGain) return;
    const weatherScale = this.weather === 'rain' ? 1.55 : this.weather === 'cloudy' ? .86 : 1;
    const level = this.settings.muted ? 0 : .032 * this.settings.ambience * weatherScale;
    this.ambientGain.gain.setTargetAtTime(level, this.ac.currentTime, .12);
    this.ambientFilter?.frequency.setTargetAtTime(this.weather === 'rain' ? 2_100 : this.weather === 'cloudy' ? 690 : 850, this.ac.currentTime, .3);
  }

  private createWind(ac: AudioContext): void {
    const length = ac.sampleRate * 4;
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x51f15e;
    let previous = 0;
    for (let index = 0; index < length; index++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const white = ((seed >>> 0) / 0xffffffff) * 2 - 1;
      previous = previous * .985 + white * .015;
      data[index] = previous * .9;
    }
    const source = ac.createBufferSource();
    source.buffer = buffer; source.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 850;
    const gain = ac.createGain(); gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(ac.destination);
    source.start();
    this.windSource = source;
    this.ambientFilter = filter;
    this.ambientGain = gain;
  }

  private createEngine(ac: AudioContext): void {
    const osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 48;
    const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260;
    const gain = ac.createGain(); gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(ac.destination); osc.start();
    this.engineOsc = osc; this.engineGain = gain;
  }

}
