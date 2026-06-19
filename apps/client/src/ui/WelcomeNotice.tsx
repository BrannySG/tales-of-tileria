import { PATCH_NOTES } from '../content/patchNotes';

interface WelcomeNoticeProps {
  /** Dismiss handler — invoked on backdrop click or the close button. */
  onClose: () => void;
  /**
   * First-time framing (shown at the end of onboarding) vs. the returning-player
   * "welcome back" framing (shown on each load). Only changes the copy.
   */
  variant?: 'intro' | 'return';
}

/**
 * A tap-to-close developer welcome + update notes overlay. Shown once at the end
 * of onboarding (intro) and on every load for returning players (return). Unlike
 * the old auto-skipping notice, it stays until the player dismisses it. Follows
 * the backdrop-click + stopPropagation pattern used by CraftingMenu/SettingsMenu.
 */
export function WelcomeNotice({ onClose, variant = 'intro' }: WelcomeNoticeProps) {
  return (
    <div className="welcome-overlay" onClick={onClose} role="presentation">
      <div
        className="welcome-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
      >
        <button className="welcome-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="welcome-kicker">A note from the developer</p>
        {variant === 'intro' ? (
          <>
            <h2>Welcome to Tales of Tileria!</h2>
            <p>
              You’ve reached the end of the private intro and are now entering the first shared
              prototype space. This game is still early, but the core loop is taking shape: gather
              resources, level skills, craft upgrades, unlock new interactions, and rebuild your lost
              divine power.
            </p>
            <p>Thanks for playing — feedback genuinely helps shape where this goes next.</p>
          </>
        ) : (
          <>
            <h2>Welcome back to Tales of Tileria!</h2>
            <p>
              Your divine work continues. The world is still taking shape — here’s what’s new since
              you were last here.
            </p>
          </>
        )}

        <div className="welcome-notes">
          <h3>Update Notes</h3>
          {PATCH_NOTES.map((entry) => (
            <div className="welcome-note" key={entry.version}>
              <p className="welcome-note-head">
                <span className="welcome-note-version">v{entry.version}</span>
                <span className="welcome-note-date">{entry.date}</span>
              </p>
              <ul>
                {entry.notes.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button className="welcome-dismiss" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
