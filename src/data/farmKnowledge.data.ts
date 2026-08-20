export interface FarmerKnowledgeLevelDef {
  level: number;
  name: string;
  minPoints: number;
  fieldNote: string;
  sourceLabel: string;
}

/**
 * Concise, presentation-only learning notes. Progress is earned from real farm
 * actions; levels deliberately grant no hidden yield or economy multiplier.
 */
export const FARMER_KNOWLEDGE_LEVELS: readonly FarmerKnowledgeLevelDef[] = [
  {
    level: 1,
    name: 'New Hand',
    minPoints: 0,
    fieldNote: 'Healthy germination needs moisture, oxygen, and suitable warmth.',
    sourceLabel: 'USDA plant-science guidance',
  },
  {
    level: 2,
    name: 'Field Hand',
    minPoints: 12,
    fieldNote: 'Crop rotation can interrupt pest cycles and spread nutrient demand; this farm models it as a simple timing boost.',
    sourceLabel: 'USDA crop-rotation guidance · game simplification',
  },
  {
    level: 3,
    name: 'Grower',
    minPoints: 35,
    fieldNote: 'Harvest timing and moisture both affect how well grain stores.',
    sourceLabel: 'University Extension storage guidance',
  },
  {
    level: 4,
    name: 'Operator',
    minPoints: 75,
    fieldNote: 'Repeated heavy traffic can compact soil, restrict roots, and reduce infiltration.',
    sourceLabel: 'USDA NRCS soil guidance',
  },
  {
    level: 5,
    name: 'Farm Manager',
    minPoints: 130,
    fieldNote: 'A crop only becomes revenue when harvest, storage, hauling, and market timing work together.',
    sourceLabel: 'Farm business principle',
  },
] as const;
