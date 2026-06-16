import { useState } from 'react';
import type { ToolType } from '@tot/shared';
import { ASSET_URL, TOOL_ICON } from '../assets/manifest';

const TOOLS: ToolType[] = ['sword', 'axe', 'pickaxe'];
const EMPTY_SLOTS = 3;

const TOOL_LABEL: Record<ToolType, string> = {
  sword: 'Stone Sword',
  axe: 'Stone Axe',
  pickaxe: 'Stone Pickaxe',
};

export function Hotbar({
  active,
  onSelect,
}: {
  active: ToolType;
  onSelect: (tool: ToolType) => void;
}) {
  const [hovered, setHovered] = useState<ToolType | null>(null);
  const labelTool = hovered ?? active;

  return (
    <div className="hotbar">
      <div className="hotbar-tooltip">{TOOL_LABEL[labelTool]}</div>
      <div className="hotbar-slots">
        {TOOLS.map((tool) => (
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
        {Array.from({ length: EMPTY_SLOTS }, (_, i) => (
          <div key={i} className="hotbar-slot empty" />
        ))}
      </div>
    </div>
  );
}
