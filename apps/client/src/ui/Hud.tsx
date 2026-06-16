import type { CombatConfig, ToolType } from '@tot/shared';
import { useHud } from '../state/store';
import { Hotbar } from './Hotbar';
import { DevPanel } from './DevPanel';

export interface HudCallbacks {
  onLock: () => void;
  onUnlock: () => void;
  onSelectTool: (tool: ToolType) => void;
  onCombatChange: (partial: Partial<CombatConfig>) => void;
  onToggleSound: (enabled: boolean) => void;
}

export interface HudProps extends HudCallbacks {
  title?: string;
  subtitle?: string;
  locationName?: string;
}

function Resources() {
  const inventory = useHud((s) => s.inventory);
  const entries: [string, number][] = [
    ['Wood', inventory.wood ?? 0],
    ['Stone', inventory.stone ?? 0],
  ];
  for (const [id, qty] of Object.entries(inventory)) {
    if (id !== 'wood' && id !== 'stone' && qty > 0) entries.push([id, qty]);
  }
  return (
    <div className="hud-resources">
      {entries.map(([label, qty]) => (
        <span className="hud-resource" key={label}>
          {label}: {qty}
        </span>
      ))}
    </div>
  );
}

function TargetPanel({
  onLock,
  onUnlock,
}: {
  onLock: () => void;
  onUnlock: () => void;
}) {
  const target = useHud((s) => s.target);
  const locked = useHud((s) => s.locked);
  if (!target) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 74,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(20,22,27,0.7)',
        border: '1px solid var(--panel-border)',
        borderRadius: 10,
        padding: '6px 12px',
        fontWeight: 700,
      }}
    >
      <span>{target.name}</span>
      <span style={{ color: 'var(--muted)' }}>
        {target.hp}/{target.maxHp}
      </span>
      <button
        className="btn"
        style={{ width: 'auto', margin: 0, padding: '5px 12px' }}
        onClick={locked ? onUnlock : onLock}
      >
        {locked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  );
}

export function Hud(props: HudProps) {
  const tool = useHud((s) => s.equippedTool);
  const title = props.title ?? 'CONTENT ZOO';
  const subtitle = props.subtitle ?? 'Tune the feel of hits, idle locking, and respawns.';
  const locationName = props.locationName ?? 'The Content Zoo';
  return (
    <div className="hud">
      <Resources />
      <div className="hud-quest">
        <h4>{title}</h4>
        <div>{subtitle}</div>
      </div>
      <div className="hud-location">
        <small>Tileria</small>
        {locationName}
      </div>
      <TargetPanel onLock={props.onLock} onUnlock={props.onUnlock} />
      <Hotbar active={tool} onSelect={props.onSelectTool} />
      <DevPanel onCombatChange={props.onCombatChange} onToggleSound={props.onToggleSound} />
    </div>
  );
}
