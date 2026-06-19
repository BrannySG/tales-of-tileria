import type { CursorMode } from './cursor';
import type { Player } from './player';
import type { PlayerId, SimCommand, SimEvent, ZoneSnapshot } from './protocol';
import type { ToolType } from './ids';

/**
 * The wire protocol between the client `WebSocketTransport` and the
 * authoritative server (router Worker + `InstanceDO`), see ADR-0016. Everything
 * is JSON; the sim's own `SimCommand`/`SimEvent` shapes ride inside envelopes so
 * the transport boundary stays the single contract (mirrors `SimTransport`).
 */

/** Lightweight presence record for another player in the instance. */
export interface PresenceInfo {
  playerId: PlayerId;
  name: string;
  x: number;
  y: number;
  mode?: CursorMode;
  equippedToolType?: ToolType;
  /** The player's equipped Cursor skin id, so others render the right art. */
  cursorSkinId?: string;
}

/** Messages the client sends to the server. */
export type ClientMessage =
  | {
      /**
       * First message after the socket opens: identifies the player and seeds
       * the server with the client's carried Player snapshot (see ADR-0016;
       * server-side persistence is deferred, so the client is the source today).
       */
      type: 'join';
      playerId: PlayerId;
      name: string;
      player: Player;
    }
  | { type: 'command'; command: SimCommand };

/** Messages the server sends to the client. */
export type ServerMessage =
  | {
      /**
       * Sent once on join: the authoritative snapshot for this player plus the
       * list of players already present, so the client can hydrate and spawn
       * remote cursors immediately.
       */
      type: 'welcome';
      playerId: PlayerId;
      snapshot: ZoneSnapshot;
      presence: PresenceInfo[];
    }
  | { type: 'event'; event: SimEvent }
  | { type: 'events'; events: SimEvent[] }
  | { type: 'error'; message: string };

/**
 * Reason the router could not place a player (e.g. an unknown or single-player
 * Level). Carried as the WebSocket close reason / an `error` message.
 */
export type JoinRejection = 'unknownLevel' | 'notMultiplayer' | 'full';
