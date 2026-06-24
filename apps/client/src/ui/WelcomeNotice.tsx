import { PATCH_NOTES } from '../content/patchNotes';

interface WelcomeNoticeProps {
  /** Dismiss handler — invoked on backdrop click or the close button. */
  onClose: () => void;
  /**
   * First-time framing (shown at the end of onboarding) vs. the returning-player
   * "welcome back" framing (shown on each load). Only changes the copy.
   */
  variant?: 'intro' | 'return';
  /**
   * True when this load reset the player's progression (the testing
   * `WIPE_PROGRESSION_ON_JOIN` toggle is on). Adds a dev heads-up explaining the
   * wipe. Only meaningful for the returning-player variant.
   */
  progressionWiped?: boolean;
}

/**
 * A tap-to-close developer welcome + update notes overlay. Shown once at the end
 * of onboarding (intro) and on every load for returning players (return). Unlike
 * the old auto-skipping notice, it stays until the player dismisses it. Follows
 * the backdrop-click + stopPropagation pattern used by CraftingMenu/SettingsMenu.
 */
export function WelcomeNotice({ onClose, variant = 'intro', progressionWiped = false }: WelcomeNoticeProps) {
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
        <p className="welcome-kicker">A note from Branny (the dev)</p>
        <h2>{variant === 'intro' ? 'Welcome to Tales of Tileria!' : 'Welcome back to Tales of Tileria!'}</h2>
        <p>
          If you’re playing this version of the game, it’s because you’re awesome. Fair warning:
          expect things to change drastically over time. This is a super rough first draft of what
          I’m hoping to build — expect data wipes, content changes, system overhauls, and more.
        </p>
        <p>
          My goal is to keep the game playable so I can gather feedback and iterate as you play. I
          hope you enjoy it — send feedback on X:{' '}
          <a href="https://x.com/BrannyTweets" target="_blank" rel="noopener noreferrer">
            @BrannyTweets
          </a>
        </p>

        {variant === 'return' && progressionWiped && (
          <div className="welcome-wipe-note">
            <p>
              <strong>Heads-up:</strong> while I’m testing, I’m wiping everyone’s progress every time
              you jump back in — so you’re starting fresh again. This is on purpose (and temporary),
              just to make testing easier on my end.
            </p>
            <p>
              Don’t worry, I kept the important stuff: your name and any cursors you’ve unlocked stick
              around. Everything else — skills, inventory, tools, quests — has been reset to the
              starter kit. Thanks for bearing with me!
            </p>
          </div>
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
