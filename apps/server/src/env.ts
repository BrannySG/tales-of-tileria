/** Durable Object bindings declared in wrangler.jsonc. */
export interface Env {
  /** One instance per Level instance (the authoritative `World`). */
  INSTANCE: DurableObjectNamespace;
  /** One router per Level id: density-first instance assignment. */
  ROUTER: DurableObjectNamespace;
}
