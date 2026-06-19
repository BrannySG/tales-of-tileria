/** Something the renderer ticks each frame (wisps, director props, captions). */
export interface Updatable {
  update(dt: number): void;
}
