export type OnboardingVariant = 'minimal' | 'arc';

/**
 * Active first-run flow. Keep this as a typed constant so switching between the
 * minimal onboarding and the parked full arc is a one-line change.
 */
export const ONBOARDING_VARIANT: OnboardingVariant = 'minimal';
