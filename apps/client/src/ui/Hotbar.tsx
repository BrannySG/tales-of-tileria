import { useState } from 'react';
import { getToolDefinition, type ToolDefinition, type ToolId, type ToolType } from '@tot/shared';
import { ASSET_URL } from '../assets/manifest';

/** Stable display order for owned tools in the hotbar. */
const TYPE_ORDER: ToolType[] = ['sword', 'axe', 'pickaxe'];
const SLOT_COUNT = 6;

/**
 * Resolves the owned tool ids into one slot per tool *type*, each represented by
 * the highest-tier tool of that type the player owns (auto-replace leaves a
 * single tool per type in normal play; the all-tools Zoo shows the best). The
 * slot's label + icon come from that tool's definition, so the hotbar reflects
 * what the player actually holds — "Rusty Axe", then "Stone Axe" once upgraded.
 */
function ownedSlots(ownedToolIds: readonly ToolId[]): ToolDefinition[] {
  const slots: ToolDefinition[] = [];
  for (const type of TYPE_ORDER) {
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
  const slots = ownedSlots(ownedToolIds);
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
