import type { CombatConfig, Rarity } from '@tot/shared';
import { RARITIES } from '@tot/shared';
import { useHud } from '../state/store';
import { OnboardingDevControl } from './OnboardingDevControl';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <div className="dev-row">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="val">{format ? format(value) : value}</span>
    </div>
  );
}

export function DevPanel({
  onCombatChange,
  onToggleSound,
  onTestLootBurst,
}: {
  onCombatChange: (partial: Partial<CombatConfig>) => void;
  onToggleSound: (enabled: boolean) => void;
  onTestLootBurst: (rarity: Rarity) => void;
}) {
  const combat = useHud((s) => s.combat);
  const soundEnabled = useHud((s) => s.soundEnabled);

  return (
    <div className="dev-panel">
      <h4>DEV — TUNE FEEL</h4>
      <Slider
        label="Active dmg"
        value={combat.activeDamage}
        min={1}
        max={50}
        step={1}
        onChange={(v) => onCombatChange({ activeDamage: v })}
      />
      <Slider
        label="Passive dmg"
        value={combat.passiveDamagePerTick}
        min={0}
        max={20}
        step={1}
        onChange={(v) => onCombatChange({ passiveDamagePerTick: v })}
      />
      <Slider
        label="Tick (s)"
        value={combat.passiveTickSeconds}
        min={0.1}
        max={2}
        step={0.1}
        onChange={(v) => onCombatChange({ passiveTickSeconds: v })}
        format={(v) => v.toFixed(1)}
      />
      <div className="dev-row">
        <label>Sound</label>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(e) => onToggleSound(e.target.checked)}
        />
        <span className="val">{soundEnabled ? 'on' : 'off'}</span>
      </div>
      <div className="dev-row dev-loot">
        <label>Loot burst</label>
        <div className="dev-loot-buttons">
          {RARITIES.map((r) => (
            <button key={r} type="button" className={`loot-rarity ${r}`} onClick={() => onTestLootBurst(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <OnboardingDevControl />
      <p className="editor-hint" style={{ marginBottom: 0 }}>
        Hover an entity to passively damage it. Click to tap. Lock to idle-farm hands-free.
      </p>
    </div>
  );
}
