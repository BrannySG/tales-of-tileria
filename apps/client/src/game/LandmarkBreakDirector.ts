import { getEntityDefinition, type SimEvent } from '@tot/shared';
import type { WorldSession } from './useWorldScene';

/**
 * Client Director (see ADR-0005, AGENTS.md invariant #4) that turns the FIRST
 * break of a Landmark Personal Breakable (see CONTEXT.md: Landmark; ADR-0025)
 * into a "moment": it watches the sim's player-scoped `entity.brokenForPlayer`
 * and, when the broken entity is a `landmark`, drives the CinematicController —
 * a brief zoom/hold on the stump, an impact shake, a dust/leaf burst, and a
 * couple of narration lines — before easing the camera back. The actual remnant
 * swap + signpost reveal are done by the SceneRenderer from the same event; this
 * only layers presentation on top and never touches sim state.
 *
 * It fires once per break: the sim emits `entity.brokenForPlayer` a single time
 * per player (guarded by `Player.brokenEntities`), and a returning player whose
 * Landmark is already broken hydrates from the snapshot with no event.
 */
export class LandmarkBreakDirector {
  private unsubscribe?: () => void;
  private running = false;
  private cancelled = false;
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly session: WorldSession) {}

  /** Subscribes to break events; returns a disposer (call on scene teardown). */
  start(): () => void {
    this.unsubscribe = this.session.transport.subscribe((event) => this.onEvent(event));
    return () => this.dispose();
  }

  private onEvent(event: SimEvent): void {
    if (event.type !== 'entity.brokenForPlayer') return;
    const def = getEntityDefinition(event.definitionId);
    if (!def?.tags?.includes('landmark')) return;
    void this.runMoment(event.x, event.y, def.displayName);
  }

  private async runMoment(x: number, y: number, name: string): Promise<void> {
    if (this.running || this.cancelled) return;
    this.running = true;
    const { renderer } = this.session;

    // Zoom/hold on the stump, then the impact: shake, flash, dust + leaves.
    await renderer.cameraFocus({ x, y }, { zoom: 1.7, durationMs: 700, anchor: { x: 0.5, y: 0.55 } });
    if (this.cancelled) return;
    renderer.playSound('deplete', { pitchVariation: 0.1 });
    renderer.flashScreen(0xfff6df, 0.45, 280);
    renderer.particleBurst('fx_wood_chip', x, y - 40, { count: 30, speed: 380, scale: 0.85 });
    renderer.particleBurst('fx_leaf', x, y - 70, { count: 20, speed: 240, scale: 0.7 });
    await renderer.cameraShake(460, 20);
    if (this.cancelled) return;

    renderer.floatText(x, y - 210, `The ${name} splinters apart!`, {
      color: 0xffe08a,
      size: 40,
      life: 2.2,
      vy: -28,
    });
    await this.sleep(1300);
    if (this.cancelled) return;

    renderer.floatText(x, y - 210, 'A path north lies open.', {
      color: 0xbfe9ff,
      size: 34,
      life: 2.2,
      vy: -28,
    });
    await this.sleep(1100);
    if (this.cancelled) return;

    await renderer.cameraReset({ durationMs: 1000 });
    this.running = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      this.timers.push(t);
    });
  }

  private dispose(): void {
    this.cancelled = true;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
  }
}
