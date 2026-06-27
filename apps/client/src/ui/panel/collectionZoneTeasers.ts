import type { PanelLevelVM } from './panelTypes';

/** Presentation-only teaser rows for future Collections zones. */
export const COMING_SOON_COLLECTION_ZONES: readonly PanelLevelVM[] = [
  {
    id: 'deepwood_01_teaser',
    name: 'The Deepwood',
    completed: 0,
    total: 0,
    available: false,
    comingSoon: true,
    subtitle: 'Coming soon',
    iconTextureId: 'entity_ancient_tree',
  },
];
