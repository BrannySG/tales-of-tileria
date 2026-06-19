import { useHud } from '../state/store';

interface VolumeRowProps {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function VolumeRow({ label, value, disabled, onChange }: VolumeRowProps) {
  return (
    <div className={`settings-row ${disabled ? 'disabled' : ''}`}>
      <label>{label}</label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="settings-val">{Math.round(value * 100)}</span>
    </div>
  );
}

/**
 * The settings menu: a modal exposing the player's audio preferences (master
 * mute, music volume, SFX volume). Changes are applied live to the running
 * session's SoundSystem and persisted via the HUD store (see store.ts).
 */
export function SettingsMenu({
  onMusicVolumeChange,
  onSfxVolumeChange,
  onToggleSound,
  onClose,
}: {
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onToggleSound: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const soundEnabled = useHud((s) => s.soundEnabled);
  const musicVolume = useHud((s) => s.musicVolume);
  const sfxVolume = useHud((s) => s.sfxVolume);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span>Settings</span>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <h4 className="settings-section">Audio</h4>

        <div className="settings-row">
          <label>Sound</label>
          <button
            className={`settings-toggle ${soundEnabled ? 'on' : 'off'}`}
            role="switch"
            aria-checked={soundEnabled}
            onClick={() => onToggleSound(!soundEnabled)}
          >
            <span className="settings-toggle-knob" />
          </button>
          <span className="settings-val">{soundEnabled ? 'On' : 'Off'}</span>
        </div>

        <VolumeRow
          label="Music"
          value={musicVolume}
          disabled={!soundEnabled}
          onChange={onMusicVolumeChange}
        />
        <VolumeRow
          label="Effects"
          value={sfxVolume}
          disabled={!soundEnabled}
          onChange={onSfxVolumeChange}
        />
      </div>
    </div>
  );
}
