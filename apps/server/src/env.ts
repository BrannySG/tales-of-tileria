/** Durable Object bindings declared in wrangler.jsonc. */
export interface Env {
  /** One instance per Level instance (the authoritative `World`). */
  INSTANCE: DurableObjectNamespace;
  /** One router per Level id: density-first instance assignment. */
  ROUTER: DurableObjectNamespace;
  /** The single global leaderboard, addressed by the fixed name `global` (see ADR-0019). */
  LEADERBOARD: DurableObjectNamespace;
}
