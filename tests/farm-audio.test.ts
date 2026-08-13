import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FARM_AUDIO_SETTINGS, FARM_AUDIO_SETTINGS_KEY, normalizeFarmAudioSettings,
  FarmSoundscape, readFarmAudioSettings, writeFarmAudioSettings,
} from '../src/audio/farmSoundscape';

describe('farm audio preferences', () => {
  it('uses restrained defaults and clamps malformed volumes', () => {
    expect(normalizeFarmAudioSettings(null)).toEqual(DEFAULT_FARM_AUDIO_SETTINGS);
    expect(normalizeFarmAudioSettings({ muted: true, ambience: 4, effects: -2 })).toEqual({
      muted: true, ambience: 1, effects: 0,
    });
    expect(normalizeFarmAudioSettings({ muted: 'yes', ambience: Number.NaN })).toEqual(DEFAULT_FARM_AUDIO_SETTINGS);
  });

  it('round-trips preferences through the isolated local key', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    writeFarmAudioSettings(storage, { muted: false, ambience: .2, effects: .8 });
    expect([...values.keys()]).toEqual([FARM_AUDIO_SETTINGS_KEY]);
    expect(readFarmAudioSettings(storage)).toEqual({ muted: false, ambience: .2, effects: .8 });
  });

  it('fails safely when storage is missing, corrupt, or unavailable', () => {
    expect(readFarmAudioSettings(null)).toEqual(DEFAULT_FARM_AUDIO_SETTINGS);
    expect(readFarmAudioSettings({ getItem: () => '{nope', setItem: () => {} })).toEqual(DEFAULT_FARM_AUDIO_SETTINGS);
    expect(() => writeFarmAudioSettings({ getItem: () => null, setItem: () => { throw new Error('blocked'); } }, DEFAULT_FARM_AUDIO_SETTINGS)).not.toThrow();
  });

  it('tracks weather as transient mix state without changing persisted preferences', () => {
    const soundscape = new FarmSoundscape(null);
    soundscape.update(null, false, 'rain');
    expect(soundscape.snapshot()).toMatchObject({ weather: 'rain', started: false });
    expect(readFarmAudioSettings(null)).toEqual(DEFAULT_FARM_AUDIO_SETTINGS);
  });
});
