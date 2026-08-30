import { describe, expect, it } from 'vitest';
import { harvestWagonLoadPresentation, tractorAttachmentHitShape, tractorWagonRenderOffset } from '../src/render/farmMachinery';

describe('farm machinery render truthfulness', () => {
  it('derives visible grain fill from the actual tier capacity and current load', () => {
    expect(harvestWagonLoadPresentation('basic', 0)).toMatchObject({ capacity: 240, fill: 0, cargoCount: 0 });
    expect(harvestWagonLoadPresentation('basic', 120)).toMatchObject({ capacity: 240, fill: .5 });
    expect(harvestWagonLoadPresentation('county', 120)).toMatchObject({ capacity: 480, fill: .25 });
    expect(harvestWagonLoadPresentation('county', 9_999).fill).toBe(1);
  });

  it('keeps basic and County wagon attachments visibly and interactively distinct', () => {
    expect(tractorAttachmentHitShape('county').halfLength).toBeGreaterThan(tractorAttachmentHitShape('basic').halfLength);
  });

  it('moves a real wagon only far enough behind a planting toolbar to keep the composition legible', () => {
    expect(tractorWagonRenderOffset('plant')).toBe(-40);
    expect(tractorWagonRenderOffset('harvest')).toBe(0);
    expect(tractorWagonRenderOffset()).toBe(0);
  });
});
