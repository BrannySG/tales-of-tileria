/// <reference types="vite/client" />

/** Slice-metadata sidecar emitted by the spritegen `ui-frame` preset. */
declare module '*.frame.json' {
  const meta: {
    src: string;
    mode: 'border-image';
    slice: number;
    border: number;
    repeat: 'stretch' | 'round';
  };
  export default meta;
}
