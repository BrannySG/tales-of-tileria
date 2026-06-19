import { useState } from 'react';
import {
  bestUsableTool,
  getToolDefinition,
  type SkillId,
  type ToolDefinition,
  type ToolId,
  type ToolType,
} from '@tot/shared';
import { ASSET_URL } from '../assets/manifest';
import { useHud } from '../state/store';

/** Stable display order for owned tools in the hotbar. */
const TYPE_ORDER: ToolType[] = ['sword', 'axe', 'pickaxe'];
const SLOT_COUNT = 6;

/**
 * Resolves the owned tool ids into one slot per tool *type*, represented by the
 * best tool of that type the player can actually *wield* now (so a Stone Axe
 * owned before Woodcutting 3 doesn't masquerade as equippable — the still-usable
 * Rusty Axe shows instead). Falls back to the best owned tier only when no usable
 * tool of the type exists, so the slot still appears.
 */
function ownedSlots(
  ownedToolIds: readonly ToolId[],
  skillLevel: (skillId: SkillId) => number,
): ToolDefinition[] {
  const slots: ToolDefinition[] = [];
  for (const type of TYPE_ORDER) {
    const usable = bestUsableTool(ownedToolIds, type, skillLevel);
    if (usable) {
      slots.push(usable);
      continue;
    }
    const best = ownedToolIds
      .map((id) => getToolDefinition(id))
      .filter((d): d is ToolDefinition => Boolean(d) && d!.toolType === type)
      .reduce<ToolDefinition | undefined>((acc, d) => (!acc || d.tier > acc.tier ? d : acc), undefined);
    if (best) slots.push(best);
  }
  return slots;
}

/**
 * Bottom-center hotbar. Shows only tools the player owns (empty until the first
 * pickup); the equipped tool is highlighted. Tools are authoritative sim state
 * (see ADR-0006) — selecting one asks the sim to equip its type.
 */
export function Hotbar({
  ownedToolIds,
  active,
  onSelect,
}: {
  ownedToolIds: ToolId[];
  active: ToolType | undefined;
  onSelect: (tool: ToolType) => void;
}) {
  const skills = useHud((s) => s.skills);
  const slots = ownedSlots(ownedToolIds, (skillId) => skills[skillId]?.level ?? 1);
  const [hovered, setHovered] = useState<ToolType | null>(null);
  const labelTool =
    slots.find((s) => s.toolType === hovered) ??
    slots.find((s) => s.toolType === active) ??
    slots[0];
  const emptySlots = Math.max(0, SLOT_COUNT - slots.length);

  return (
    <div className="hotbar">
      {labelTool && <div className="hotbar-tooltip">{labelTool.displayName}</div>}
      <div className="hotbar-slots">
        {slots.map((tool) => (
          <button
            key={tool.toolType}
            className={`hotbar-slot ${active === tool.toolType ? 'active' : ''}`}
            onClick={() => onSelect(tool.toolType)}
            onMouseEnter={() => setHovered(tool.toolType)}
            onMouseLeave={() => setHovered((h) => (h === tool.toolType ? null : h))}
          >
            <img src={ASSET_URL[tool.iconTextureId]} alt={tool.displayName} />
          </button>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div key={i} className="hotbar-slot empty" />
        ))}
      </div>
    </div>
  );
}
