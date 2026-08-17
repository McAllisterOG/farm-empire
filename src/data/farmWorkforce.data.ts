import type { AvatarConfig } from '../core/types';

export const FIRST_FARMHAND = {
  id: 'mara-bell',
  name: 'Mara Bell',
  role: 'County Farmhand',
  hirePriceCents: 180_000,
  dailyShiftCents: 12_000,
  avatar: {
    skin: 'cl_skin_deep',
    hair: 'cl_hair_long_black',
    face: 'cl_face_smile',
    top: 'cl_top_tee_blue',
    bottom: 'cl_bottom_shorts',
    hat: null,
    accessory: null,
  } satisfies AvatarConfig,
} as const;

export const FIRST_FARM_MANAGER = {
  id: 'first-farm-manager',
  name: 'Farm Manager Contract',
  hirePriceCents: 240_000,
} as const;
