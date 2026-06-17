import { useState } from 'react';
import { clearOnboarded, hasOnboarded } from '../onboarding';

/**
 * Dev-only control for resetting the first-time onboarding flag. Shown on the
 * title screen and inside the Zoo dev panel.
 */
export function OnboardingDevControl() {
  const [onboarded, setOnboarded] = useState(hasOnboarded);

  if (!import.meta.env.DEV) return null;

  const resetToTitle = () => {
    clearOnboarded();
    setOnboarded(false);
    window.location.hash = '/title';
  };

  const replayOnboarding = () => {
    clearOnboarded();
    setOnboarded(false);
    window.location.hash = '/onboarding';
  };

  return (
    <div className="dev-onboarding">
      <span className="dev-onboarding-status">{onboarded ? 'Onboarded' : 'New player'}</span>
      <button type="button" className="dev-onboarding-btn" onClick={resetToTitle}>
        Reset → title
      </button>
      <button type="button" className="dev-onboarding-btn" onClick={replayOnboarding}>
        Replay onboarding
      </button>
    </div>
  );
}
