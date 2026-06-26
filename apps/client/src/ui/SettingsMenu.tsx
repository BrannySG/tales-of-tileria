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

interface PercentRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onReset?: () => void;
}

function PercentRow({ label, value, min, max, step, onChange, onReset }: PercentRowProps) {
  return (
    <div className="settings-row">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="settings-val">{Math.round(value * 100)}%</span>
      {onReset && (
        <button className="settings-inline-btn" onClick={onReset} type="button">
          Reset
        </button>
      )}
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
  onUiScaleChange,
  onToggleScreenshotMode,
  onToggleSound,
  onForceWipe,
  onClose,
}: {
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onUiScaleChange: (scale: number) => void;
  onToggleScreenshotMode: (enabled: boolean) => void;
  onToggleSound: (enabled: boolean) => void;
  /** Wipe the saved progression (keeps name + cosmetics) and reload the game. */
  onForceWipe: () => void;
  onClose: () => void;
}) {
  const soundEnabled = useHud((s) => s.soundEnabled);
  const musicVolume = useHud((s) => s.musicVolume);
  const sfxVolume = useHud((s) => s.sfxVolume);
  const uiScale = useHud((s) => s.uiScale);
  const hudVisible = useHud((s) => s.hudVisible);
  const screenshotMode = !hudVisible;

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

        <h4 className="settings-section">Display</h4>
        <PercentRow
          label="UI Scale"
          value={uiScale}
          min={0.75}
          max={1.75}
          step={0.05}
          onChange={onUiScaleChange}
          onReset={() => onUiScaleChange(1)}
        />
        <div className="settings-row">
          <label>Screenshot Mode</label>
          <button
            className={`settings-toggle ${screenshotMode ? 'on' : 'off'}`}
            role="switch"
            aria-checked={screenshotMode}
            onClick={() => onToggleScreenshotMode(!screenshotMode)}
          >
            <span className="settings-toggle-knob" />
          </button>
          <span className="settings-val">{screenshotMode ? 'On' : 'Off'}</span>
        </div>

        <h4 className="settings-section">Save</h4>

        <div className="settings-row settings-row--wide">
          <button
            className="settings-danger-btn"
            onClick={() => {
              const ok = window.confirm(
                'Force wipe your saved progress?\n\n' +
                  'This resets skills, inventory, tools, quests, collections, and skill trees ' +
                  'back to the starter kit. Your name and unlocked cursors are kept. The game ' +
                  'will reload.',
              );
              if (ok) onForceWipe();
            }}
          >
            Force wipe save
          </button>
        </div>
      </div>
    </div>
  );
}
