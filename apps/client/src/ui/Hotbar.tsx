import { useState } from 'react';
import type { ToolType } from '@tot/shared';
import { ASSET_URL, TOOL_ICON } from '../assets/manifest';

/** Stable display order for owned tools in the hotbar. */
const TOOL_ORDER: ToolType[] = ['sword', 'axe', 'pickaxe'];
const SLOT_COUNT = 6;

const TOOL_LABEL: Record<ToolType, string> = {
  sword: 'Stone Sword',
  axe: 'Stone Axe',
  pickaxe: 'Stone Pickaxe',
};

/**
 * Bottom-center hotbar. Shows only tools the player owns (empty until the first
 * pickup); the equipped tool is highlighted. Tools are authoritative sim state
 * (see ADR-0006) — selecting one asks the sim to equip it.
 */
export function Hotbar({
  owned,
  active,
  onSelect,
}: {
  owned: ToolType[];
  active: ToolType | undefined;
  onSelect: (tool: ToolType) => void;
}) {
  const tools = TOOL_ORDER.filter((t) => owned.includes(t));
  const [hovered, setHovered] = useState<ToolType | null>(null);
  const labelTool = hovered ?? active ?? tools[0];
  const emptySlots = Math.max(0, SLOT_COUNT - tools.length);

  return (
    <div className="hotbar">
      {labelTool && <div className="hotbar-tooltip">{TOOL_LABEL[labelTool]}</div>}
      <div className="hotbar-slots">
        {tools.map((tool) => (
          <button
            key={tool}
            className={`hotbar-slot ${active === tool ? 'active' : ''}`}
            onClick={() => onSelect(tool)}
            onMouseEnter={() => setHovered(tool)}
            onMouseLeave={() => setHovered((h) => (h === tool ? null : h))}
          >
            <img src={ASSET_URL[TOOL_ICON[tool]]} alt={TOOL_LABEL[tool]} />
          </button>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div key={i} className="hotbar-slot empty" />
        ))}
      </div>
    </div>
  );
}
