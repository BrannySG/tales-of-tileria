import { Container } from 'pixi.js';
import { cursorSkinTextureId, type CursorMode, type PresenceInfo, type ToolType } from '@tot/shared';
import { RemoteCursorView } from './RemoteCursorView';
import { TOOL_ICON } from '../assets/manifest';
import type { TextureMap } from './assets';
import type { Updatable } from './Updatable';

/**
 * Owns every other player's {@link RemoteCursorView} in this Level instance (see
 * ADR-0016). Lives in world space (parented under the camera) so remote cursors
 * sit at the right spot in the shared world as the local player pans. Driven by
 * presence + `cursor.moved` events plus per-hit action cues.
 */
export class RemoteCursorManager implements Updatable {
  readonly layer = new Container();
  private readonly cursors = new Map<string, RemoteCursorView>();

  constructor(
    private readonly textures: TextureMap,
    private readonly localPlayerId: string,
  ) {
    this.layer.sortableChildren = true;
  }

  /** Seeds cursors for players already present when the local player joined. */
  seed(presence: PresenceInfo[]): void {
    for (const p of presence)
      this.join(p.playerId, p.name, p.x, p.y, p.equippedToolType, p.mode, p.cursorSkinId);
  }

  join(
    playerId: string,
    name: string,
    x: number,
    y: number,
    equippedToolType?: ToolType,
    mode?: CursorMode,
    cursorSkinId?: string,
  ): void {
    if (playerId === this.localPlayerId || this.cursors.has(playerId)) return;
    const icon = equippedToolType ? TOOL_ICON[equippedToolType] : undefined;
    const view = new RemoteCursorView(
      this.textures,
      name,
      x,
      y,
      icon,
      cursorSkinTextureId(cursorSkinId),
    );
    if (mode) view.setMode(mode);
    this.cursors.set(playerId, view);
    this.layer.addChild(view.container);
  }

  /** Re-skin a remote player's cursor when they equip a new Cursor skin. */
  setSkin(playerId: string, cursorSkinId: string): void {
    if (playerId === this.localPlayerId) return;
    this.cursors.get(playerId)?.setSkin(cursorSkinTextureId(cursorSkinId));
  }

  leave(playerId: string): void {
    const view = this.cursors.get(playerId);
    if (!view) return;
    this.cursors.delete(playerId);
    view.destroy();
  }

  move(playerId: string, x: number, y: number, mode: CursorMode): void {
    if (playerId === this.localPlayerId) return;
    const view = this.cursors.get(playerId);
    if (!view) return;
    view.setTarget(x, y);
    view.setMode(mode);
  }

  /** Action cue: pulse the acting player's cursor when they land a hit. */
  hit(playerId: string): void {
    if (playerId === this.localPlayerId) return;
    this.cursors.get(playerId)?.hit();
  }

  update(dt: number): void {
    for (const view of this.cursors.values()) view.update(dt);
  }

  destroy(): void {
    for (const view of this.cursors.values()) view.destroy();
    this.cursors.clear();
    this.layer.destroy({ children: true });
  }
}
