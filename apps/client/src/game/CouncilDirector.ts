import type { WorldSession } from './useWorldScene';

interface DialogueLine {
  text: string;
  shout?: boolean;
}

export interface CouncilCallbacks {
  /** Fired when the verdict + banishment finish (host swaps to the mortal realm). */
  onComplete?: () => void;
}

/**
 * Scripts the Council of Clickers cutscene on the authored `council_01` Level
 * (see ADR-0013). Like the OnboardingDirector it owns only presentation and
 * drives authoritative state through normal commands: it reveals the council /
 * crowd via `entity.enable`, speaks through `sayAt`, and revokes the player's
 * Smite via `player.setDivinePower` — so the banishment is a real sim change the
 * carried snapshot inherits, not a render-only effect.
 */
export class CouncilDirector {
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private cancelled = false;

  constructor(
    private readonly session: WorldSession,
    private readonly cb: CouncilCallbacks = {},
  ) {}

  async run(): Promise<void> {
    const { renderer, transport } = this.session;
    const name = transport.getSnapshot().player.displayName || 'Nameless One';

    const council = this.instancesOf('council_member');
    const crowd = this.instancesOf('crowd_cursor');
    const center = council[Math.floor(council.length / 2)] ?? council[0];

    // Open on dramatic darkness, then bring up a dim celestial court.
    renderer.setBlackout(1);
    await this.sleep(900);
    if (this.cancelled) return;
    await renderer.fadeBlackout(0.5, 1200);
    if (this.cancelled) return;

    // The crowd gathers first (a murmuring ring), then the five high council.
    for (const id of crowd) {
      transport.send({ type: 'entity.enable', instanceId: id });
      await this.sleep(90);
      if (this.cancelled) return;
    }
    for (const id of council) {
      transport.send({ type: 'entity.enable', instanceId: id });
      renderer.playSound('respawn', { pitchVariation: 0.1 });
      await this.sleep(180);
      if (this.cancelled) return;
    }
    await this.sleep(500);
    if (this.cancelled) return;

    if (center) await renderer.cameraFocus(center, { zoom: 1.5, anchor: { x: 0.5, y: 0.4 } });
    if (this.cancelled) return;

    // The accusation.
    await this.say(center, [
      { text: `${name}. YOU HAVE BEEN OBSERVED FROLICKING AMONGST THE MORTALS.`, shout: true },
    ]);
    if (this.cancelled) return;

    // Scandalised murmuring from the crowd and lesser council.
    await this.say(crowd[0], [{ text: 'They chopped wood.' }]);
    await this.say(crowd[1], [{ text: 'With a mortal axe.' }]);
    await this.say(council[1], [{ text: 'Disgusting.' }]);
    await this.say(crowd[2], [{ text: 'I heard they mined stone.' }]);
    await this.say(council[3], [{ text: 'Stone? With their own cursor?' }]);
    await this.say(crowd[3], [{ text: 'Unthinkable.' }]);
    if (this.cancelled) return;

    // The verdict — Smite is revoked mid-sentence, as a real command.
    await this.say(center, [
      {
        text: `By decree of the Council of Clickers, ${name}, you are hereby banished to the Mortal Realm.`,
        shout: true,
      },
      { text: 'Your smiting rights are REVOKED.', shout: true },
    ]);
    if (this.cancelled) return;
    transport.send({ type: 'player.setDivinePower', power: 'smite', unlocked: false });
    renderer.playSound('denied');
    await this.sleep(500);
    if (this.cancelled) return;

    // Contemptuously, the tools stay.
    await this.say(council[0], [
      {
        text: 'Let them keep their disgusting mortal tools. If they adore mortal labour so, let them earn power through it.',
      },
    ]);
    await this.say(center, [
      { text: 'Your power shall be rebuilt only through labour, offerings, worship, and clicks.' },
      { text: 'May your toolbar rust.', shout: true },
    ]);
    if (this.cancelled) return;

    // The fall: the Council's theme fades as the blinding flash banishes us, then
    // we hand off to the mortal realm (where the meadow ambience returns).
    this.session.sound.stopMusic({ fadeOutMs: 900 });
    await renderer.flashWhite(520);
    if (this.cancelled) return;
    await this.sleep(500);
    this.cb.onComplete?.();
  }

  /** All live instance ids for a definition (council has five members, etc.). */
  private instancesOf(definitionId: string): string[] {
    return this.session.transport
      .getSnapshot()
      .entities.filter((e) => e.definitionId === definitionId)
      .map((e) => e.instanceId);
  }

  private async say(speakerId: string | undefined, lines: DialogueLine[]): Promise<void> {
    if (!speakerId) return;
    for (const line of lines) {
      if (this.cancelled) return;
      await this.showLine(speakerId, line);
    }
  }

  private showLine(speakerId: string, line: DialogueLine): Promise<void> {
    return new Promise((resolve) => {
      const durationMs = Math.max(1700, line.text.length * 55);
      this.session.renderer.sayAt(speakerId, line.text, {
        shout: line.shout,
        holdSeconds: durationMs / 1000 + 1.2,
      });
      let done = false;
      let removeCatcher = () => {};
      const finish = () => {
        if (done) return;
        done = true;
        removeCatcher();
        resolve();
      };
      this.timers.push(setTimeout(finish, durationMs));
      removeCatcher = this.session.renderer.addTapCatcher(finish);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timers.push(setTimeout(resolve, ms));
    });
  }

  destroy(): void {
    this.cancelled = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
  }
}
