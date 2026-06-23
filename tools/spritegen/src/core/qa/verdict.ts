import type { QaCheck, QaVerdict } from '../../types.ts';

/** Builds a verdict from checks: passes only if every hard check passes. */
export function verdictFromChecks(checks: QaCheck[], score: number, reasons: string[]): QaVerdict {
  return {
    passed: checks.every((c) => c.passed),
    score,
    checks,
    reasons,
  };
}

/** Merges QA tiers into one verdict (passes only if all tiers passed). */
export function mergeVerdicts(verdicts: QaVerdict[]): QaVerdict {
  const checks = verdicts.flatMap((v) => v.checks);
  const reasons = verdicts.flatMap((v) => v.reasons);
  const score = verdicts.length
    ? verdicts.reduce((sum, v) => sum + v.score, 0) / verdicts.length
    : 0;
  return {
    passed: verdicts.every((v) => v.passed),
    score,
    checks,
    reasons,
  };
}
