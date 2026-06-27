import type { CSSProperties } from 'react';
import type { PanelSkin } from '../skins';
import type { PanelSettingsHandlers, PanelSettingsVM } from '../../panel/panelTypes';

/**
 * The Settings tab body: the in-panel audio/display preferences (Sound, Music,
 * Effects, UI Scale, Screenshot Mode) plus the Force-wipe action. Fully wired —
 * the same callbacks the standalone SettingsMenu used, applied live to the
 * session's SoundSystem and persisted via the HUD store.
 */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={`lab-settings-toggle${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      <span className="lab-settings-knob" />
    </button>
  );
}

export function SettingsTab({
  skin,
  settings,
  handlers,
}: {
  skin: PanelSkin;
  settings: PanelSettingsVM;
  handlers: PanelSettingsHandlers;
}) {
  const t = skin.tokens;
  const label = { color: t.text } as CSSProperties;
  const val = { color: t.textMuted } as CSSProperties;
  const sliderVars = { '--slider-accent': t.accent } as CSSProperties;

  return (
    <div className="lab-settings">
      <h4 className="lab-settings-section" style={{ color: t.accent }}>
        Audio
      </h4>
      <div className="lab-settings-row">
        <span style={label}>Sound</span>
        <Toggle on={settings.soundEnabled} onChange={handlers.onToggleSound} label="Sound" />
        <span className="lab-settings-val" style={val}>
          {settings.soundEnabled ? 'On' : 'Off'}
        </span>
      </div>
      <div className={`lab-settings-row${settings.soundEnabled ? '' : ' is-disabled'}`}>
        <span style={label}>Music</span>
        <input
          type="range"
          className="lab-settings-range"
          style={sliderVars}
          min={0}
          max={1}
          step={0.01}
          value={settings.musicVolume}
          disabled={!settings.soundEnabled}
          aria-label="Music volume"
          onChange={(e) => handlers.onMusicVolume(Number(e.target.value))}
        />
        <span className="lab-settings-val" style={val}>
          {Math.round(settings.musicVolume * 100)}
        </span>
      </div>
      <div className={`lab-settings-row${settings.soundEnabled ? '' : ' is-disabled'}`}>
        <span style={label}>Effects</span>
        <input
          type="range"
          className="lab-settings-range"
          style={sliderVars}
          min={0}
          max={1}
          step={0.01}
          value={settings.sfxVolume}
          disabled={!settings.soundEnabled}
          aria-label="Effects volume"
          onChange={(e) => handlers.onSfxVolume(Number(e.target.value))}
        />
        <span className="lab-settings-val" style={val}>
          {Math.round(settings.sfxVolume * 100)}
        </span>
      </div>

      <h4 className="lab-settings-section" style={{ color: t.accent }}>
        Display
      </h4>
      <div className="lab-settings-row">
        <span style={label}>UI Scale</span>
        <input
          type="range"
          className="lab-settings-range"
          style={sliderVars}
          min={0.75}
          max={1.75}
          step={0.05}
          value={settings.uiScale}
          aria-label="UI scale"
          onChange={(e) => handlers.onUiScale(Number(e.target.value))}
        />
        <span className="lab-settings-val" style={val}>
          {Math.round(settings.uiScale * 100)}%
        </span>
        <button type="button" className="lab-settings-reset" style={val} onClick={handlers.onResetUiScale}>
          Reset
        </button>
      </div>
      <div className="lab-settings-row">
        <span style={label}>Screenshot Mode</span>
        <Toggle
          on={settings.screenshotMode}
          onChange={handlers.onToggleScreenshotMode}
          label="Screenshot mode"
        />
        <span className="lab-settings-val" style={val}>
          {settings.screenshotMode ? 'On' : 'Off'}
        </span>
      </div>

      <h4 className="lab-settings-section" style={{ color: t.accent }}>
        Save
      </h4>
      <button
        type="button"
        className="lab-settings-danger"
        onClick={() => {
          const ok = window.confirm(
            'Force wipe your saved progress?\n\n' +
              'This resets skills, inventory, tools, quests, collections, and skill trees ' +
              'back to the starter kit. Your name and unlocked cursors are kept. The game ' +
              'will reload.',
          );
          if (ok) handlers.onForceWipe();
        }}
      >
        Force wipe save
      </button>
    </div>
  );
}
