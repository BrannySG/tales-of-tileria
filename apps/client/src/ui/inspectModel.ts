import {
  bestUsableTool,
  getItemDefinition,
  getLootTable,
  requireEntityDefinition,
  type Rarity,
  type SkillId,
  type SkillState,
  type ToolId,
} from '@tot/shared';
import { isCollectibleItem } from './discoveredCollectibles';
import { skillLabel } from './skillPresentation';

export interface InspectRequirementRow {
  label: string;
  met: boolean;
}

export interface InspectDropRow {
  itemId: string;
  label: string;
  rarity: Rarity;
  hidden: boolean;
  chanceText?: string;
  quantityText: string;
}

export interface InspectXpRow {
  skillId: SkillId;
  amount: number;
  label: string;
}

export interface InspectModel {
  definitionId: string;
  name: string;
  kindLabel: string;
  description?: string;
  requirements: InspectRequirementRow[];
  xpRows: InspectXpRow[];
  drops: InspectDropRow[];
  hasHp: boolean;
  respawnSeconds?: number;
}

export interface BuildInspectModelInput {
  definitionId: string;
  ownedToolIds: readonly ToolId[];
  skills: Record<SkillId, SkillState>;
  isDiscovered: (itemId: string) => boolean;
}

function kindLabel(kind: ReturnType<typeof requireEntityDefinition>['kind']): string {
  switch (kind) {
    case 'resource':
      return 'Resource';
    case 'npc':
      return 'NPC';
    case 'pickup':
      return 'Pickup';
    case 'prop':
      return 'Prop';
    case 'questObject':
      return 'Quest Object';
    case 'shrine':
      return 'Shrine';
    case 'cursorBeing':
      return 'Cursor-being';
    default:
      return 'Entity';
  }
}

function skillLevel(skills: Record<SkillId, SkillState>, skillId: SkillId): number {
  return skills[skillId]?.level ?? 1;
}

function formatPercent(chance: number): string {
  const pct = chance * 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(3).replace(/\.?0+$/, '')}%`;
}

function combinedChance(chances: readonly number[]): number {
  let miss = 1;
  for (const chance of chances) miss *= 1 - chance;
  return 1 - miss;
}

function quantityRange(rolls: readonly { minQuantity: number; maxQuantity: number; chance: number }[]): string {
  const guaranteedMin = rolls
    .filter((roll) => roll.chance >= 1)
    .reduce((sum, roll) => sum + roll.minQuantity, 0);
  const minPositive =
    guaranteedMin > 0
      ? guaranteedMin
      : Math.min(
          ...rolls.filter((roll) => roll.chance > 0).map((roll) => roll.minQuantity),
        );
  const max = rolls
    .filter((roll) => roll.chance > 0)
    .reduce((sum, roll) => sum + roll.maxQuantity, 0);
  return minPositive === max ? `${max}` : `${minPositive}-${max}`;
}

function buildRequirements(input: BuildInspectModelInput): InspectRequirementRow[] {
  const def = requireEntityDefinition(input.definitionId);
  const req = def.requirements;
  if (!req) return [];
  const rows: InspectRequirementRow[] = [];
  if (req.toolType) {
    const minTier = req.minTier ?? 1;
    const usable = bestUsableTool(input.ownedToolIds, req.toolType, (sid) => skillLevel(input.skills, sid));
    const met = !!usable && usable.tier >= minTier;
    const typeLabel = req.toolType === 'pickaxe' ? 'Pickaxe' : req.toolType === 'axe' ? 'Axe' : 'Tool';
    const equippedLabel = usable ? ` (usable: ${usable.displayName})` : '';
    rows.push({
      label: `Requires ${typeLabel} Tier ${minTier}+${equippedLabel}`,
      met,
    });
  }
  if (req.skill) {
    const current = skillLevel(input.skills, req.skill.skillId);
    const label = skillLabel(req.skill.skillId);
    rows.push({
      label: `Requires ${label} ${req.skill.level} (you: ${current})`,
      met: current >= req.skill.level,
    });
  }
  return rows;
}

function buildXpRows(definitionId: string): InspectXpRow[] {
  const def = requireEntityDefinition(definitionId);
  const rewards = def.xp?.rewards ?? {};
  const rows: InspectXpRow[] = [];
  for (const [skillId, amount] of Object.entries(rewards) as [SkillId, number][]) {
    if (amount <= 0) continue;
    rows.push({ skillId, amount, label: `${skillLabel(skillId)} +${amount} XP` });
  }
  return rows;
}

function buildDrops(input: BuildInspectModelInput): InspectDropRow[] {
  const def = requireEntityDefinition(input.definitionId);
  const tableId = def.loot?.lootTableId;
  if (!tableId) return [];
  const table = getLootTable(tableId);
  if (!table) return [];

  const grouped = new Map<
    string,
    { chances: number[]; rolls: { minQuantity: number; maxQuantity: number; chance: number }[] }
  >();
  const order: string[] = [];
  for (const roll of table.rolls) {
    const entry = grouped.get(roll.itemId);
    if (!entry) {
      grouped.set(roll.itemId, {
        chances: [roll.chance],
        rolls: [{ minQuantity: roll.minQuantity, maxQuantity: roll.maxQuantity, chance: roll.chance }],
      });
      order.push(roll.itemId);
    } else {
      entry.chances.push(roll.chance);
      entry.rolls.push({ minQuantity: roll.minQuantity, maxQuantity: roll.maxQuantity, chance: roll.chance });
    }
  }

  return order.map((itemId) => {
    const group = grouped.get(itemId)!;
    const item = getItemDefinition(itemId);
    const rarity = item?.rarity ?? 'common';
    const chance = combinedChance(group.chances);
    const collectible = isCollectibleItem(itemId);
    const discovered = input.isDiscovered(itemId);
    // Guaranteed drops stay visible even when collectible; uncertain collectible
    // rolls remain mystery rows until discovered.
    const hidden = collectible && !discovered && chance < 1;
    if (hidden) {
      return {
        itemId,
        label: '???',
        rarity,
        hidden: true,
        quantityText: '?',
      };
    }
    return {
      itemId,
      label: item?.displayName ?? itemId,
      rarity,
      hidden: false,
      chanceText: formatPercent(chance),
      quantityText: quantityRange(group.rolls),
    };
  });
}

export function buildInspectModel(input: BuildInspectModelInput): InspectModel {
  const def = requireEntityDefinition(input.definitionId);
  return {
    definitionId: def.id,
    name: def.displayName,
    kindLabel: kindLabel(def.kind),
    description: def.description,
    requirements: buildRequirements(input),
    xpRows: buildXpRows(input.definitionId),
    drops: buildDrops(input),
    hasHp: !!def.damageable,
    respawnSeconds: def.respawns?.respawnSeconds,
  };
}
