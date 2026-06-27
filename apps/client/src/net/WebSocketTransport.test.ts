import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayer, type ZoneSnapshot } from '@tot/shared';
import { WebSocketTransport } from './WebSocketTransport';

type Handler = (e: unknown) => void;

/** Minimal in-memory WebSocket stand-in: records sent frames + fires events on demand. */
class FakeWS {
  static OPEN = 1;
  static instances: FakeWS[] = [];
  readyState = FakeWS.OPEN;
  readonly sent: string[] = [];
  private readonly handlers: Record<string, Handler[]> = {};

  constructor(readonly url: string) {
    FakeWS.instances.push(this);
  }

  addEventListener(type: string, cb: Handler): void {
    (this.handlers[type] ??= []).push(cb);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit('close', {});
  }

  emit(type: string, e: unknown): void {
    for (const h of this.handlers[type] ?? []) h(e);
  }

  /** Parsed `join`/`resync`/`command` frames this socket has sent. */
  frames(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
  }
}

function welcomeFrame(): { data: string } {
  return {
    data: JSON.stringify({
      type: 'welcome',
      playerId: 'pid',
      snapshot: {} as ZoneSnapshot,
      presence: [],
    }),
  };
}

describe('WebSocketTransport reconnect re-seed (ADR-0032)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWS.instances = [];
    vi.stubGlobal('WebSocket', FakeWS);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('joins with the frozen snapshot first, then re-seeds from live state on reconnect', () => {
    const frozen = createPlayer('pid', 'Frozen');
    const live = createPlayer('pid', 'Live');
    let liveRef = frozen;

    new WebSocketTransport({
      serverUrl: 'ws://test',
      levelId: 'lvl',
      playerId: 'pid',
      name: 'Name',
      player: frozen,
      getLivePlayer: () => liveRef,
    });

    const ws1 = FakeWS.instances[0]!;
    ws1.emit('open', {});
    const join1 = ws1.frames().find((f) => f.type === 'join')!;
    expect((join1.player as { displayName: string }).displayName).toBe('Frozen');

    // Become ready, then simulate this session making progress.
    ws1.emit('message', welcomeFrame());
    liveRef = live;

    // Drop the socket: the transport reconnects after a backoff.
    ws1.emit('close', {});
    vi.advanceTimersByTime(1000);

    const ws2 = FakeWS.instances[1]!;
    expect(ws2).toBeDefined();
    ws2.emit('open', {});
    const join2 = ws2.frames().find((f) => f.type === 'join')!;
    expect((join2.player as { displayName: string }).displayName).toBe('Live');
  });
});

describe('WebSocketTransport resync (ADR-0032)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWS.instances = [];
    vi.stubGlobal('WebSocket', FakeWS);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requestResync sends a resync frame and onResync delivers + stores the snapshot', () => {
    const transport = new WebSocketTransport({
      serverUrl: 'ws://test',
      levelId: 'lvl',
      playerId: 'pid',
      name: 'Name',
      player: createPlayer('pid', 'P'),
    });
    const ws = FakeWS.instances[0]!;
    ws.emit('open', {});
    ws.emit('message', welcomeFrame());

    transport.requestResync();
    const resyncOut = ws.frames().find((f) => f.type === 'resync');
    expect(resyncOut).toEqual({ type: 'resync', playerId: 'pid' });

    let received: ZoneSnapshot | undefined;
    transport.onResync((snap) => {
      received = snap;
    });
    const fresh = { entities: [{ instanceId: 'rock1' }] } as unknown as ZoneSnapshot;
    ws.emit('message', {
      data: JSON.stringify({ type: 'resync', snapshot: fresh, presence: [] }),
    });

    expect(received).toEqual(fresh);
    expect(transport.getSnapshot()).toEqual(fresh);
  });
});
