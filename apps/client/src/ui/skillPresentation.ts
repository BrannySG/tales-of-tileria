import type { SkillId } from '@tot/shared';

export type SkillDisplayId = SkillId | 'fishing';

export const SKILL_LABEL: Record<SkillDisplayId, string> = {
  woodcutting: 'Woodcutting',
  mining: 'Mining',
  combat: 'Combat',
  crafting: 'Crafting',
  fishing: 'Fishing',
};

export const SKILL_ICON_TEXTURE: Partial<Record<SkillDisplayId, string>> = {
  woodcutting: 'item_skill_woodcutting',
  mining: 'item_skill_mining',
  combat: 'item_skill_combat',
  crafting: 'item_skill_crafting',
};

export function skillLabel(skillId: string): string {
  return SKILL_LABEL[skillId as SkillDisplayId] ?? skillId;
}

export function skillIconTextureId(skillId: string): string | undefined {
  return SKILL_ICON_TEXTURE[skillId as SkillDisplayId];
}
