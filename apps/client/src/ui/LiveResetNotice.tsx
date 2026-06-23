interface LiveResetNoticeProps {
  onClose: () => void;
}

/**
 * One-time apology notice shown when a release intentionally wipes browser-local
 * progress. Copy is intentionally direct and personal so returning players know
 * this was deliberate early-access iteration, not a random bug.
 */
export function LiveResetNotice({ onClose }: LiveResetNoticeProps) {
  return (
    <div className="live-reset-overlay" onClick={onClose} role="presentation">
      <div
        className="live-reset-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Live data wipe notice"
      >
        <button className="live-reset-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="live-reset-kicker">Message from Branny</p>
        <h2>HEY! Branny here. Sorry, I wiped your data (on purpose).</h2>
        <p>
          You did nothing wrong, and your account was not hacked. I pushed a big early-access update
          and intentionally reset progress so the new systems start from a clean slate.
        </p>
        <p>
          We are still very early, and this can happen again while I iterate quickly. I know wipes are
          annoying, but they help me avoid weird legacy bugs and keep development moving.
        </p>
        <p>
          Thank you for testing this early and rolling with the chaos. If something feels off after
          the reset, poke me on X:{' '}
          <a href="https://x.com/BrannyTweets" target="_blank" rel="noopener noreferrer">
            @BrannyTweets
          </a>
          .
        </p>
        <button className="live-reset-dismiss" onClick={onClose}>
          Got it, let&apos;s keep going
        </button>
      </div>
    </div>
  );
}
