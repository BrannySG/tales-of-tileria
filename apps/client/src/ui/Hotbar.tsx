import type { ToolType } from '@tot/shared';
import { ASSET_URL, TOOL_ICON } from '../assets/manifest';

const TOOLS: ToolType[] = ['sword', 'axe', 'pickaxe'];
const EMPTY_SLOTS = 3;

export function Hotbar({
  active,
  onSelect,
}: {
  active: ToolType;
  onSelect: (tool: ToolType) => void;
}) {
  return (
    <div className="hotbar">
      {TOOLS.map((tool) => (
        <button
          key={tool}
          className={`hotbar-slot ${active === tool ? 'active' : ''}`}
          onClick={() => onSelect(tool)}
          title={tool}
        >
          <img src={ASSET_URL[TOOL_ICON[tool]]} alt={tool} />
        </button>
      ))}
      {Array.from({ length: EMPTY_SLOTS }, (_, i) => (
        <div key={i} className="hotbar-slot" />
      ))}
    </div>
  );
}
