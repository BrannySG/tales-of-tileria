import type { CSSProperties, ReactNode } from 'react';

/**
 * UI LAB (research spike) — reusable textured 9-slice frame primitive.
 *
 * Two ways to skin a frame from one component:
 *
 * - `border-image`: the source PNG already bakes its own colour/texture (e.g. a
 *   GenAI-painted wooden panel). CSS slices the border and stretches the centre
 *   slice (`fill`) into the interior. One image does everything.
 * - `mask-border`: the source PNG is a white silhouette mask (the Synty HUD
 *   sprites ship this way, meant to be engine-tinted). The element paints a
 *   `tint` (a wood gradient) and the mask cuts it to the frame's shape. Lets us
 *   recolour pre-made assets to any palette.
 *
 * Frame art is painted on absolutely-positioned layers *behind* the content, so
 * masking never clips the children (slots, tabs, labels).
 */
export type FrameMode = 'border-image' | 'mask-border';

export interface FrameSpec {
  /** Frame texture / mask URL. */
  src: string;
  mode: FrameMode;
  /** `border-image-slice` inset, in source pixels (single value = all sides). */
  slice: number;
  /** On-screen border thickness in px (the inset reserved for the frame edge). */
  border: number;
  /**
   * `border-image` only: whether the source's centre slice fills the interior.
   * Default true. Set false to use the frame as a pure border ring (the proper
   * 9-slice usage) and let the app paint its own panel `body` underneath — handy
   * when the generated interior is just placeholder texture.
   */
  fillCenter?: boolean;
  /**
   * `mask-border` only: the fill shown through the frame mask (e.g. a wood
   * gradient). For `border-image` this is ignored (the PNG carries colour).
   */
  tint?: string;
  /**
   * Optional solid body painted behind the frame edge. Used by the Synty skin
   * to give the recessed interior a tinted wood fill + CSS bevel relief.
   */
  body?: {
    fill: string;
    radius: number;
    /** Adds inset light/shadow so a flat fill reads as carved. */
    bevel?: boolean;
  };
}

function edgeStyle(spec: FrameSpec): CSSProperties {
  if (spec.mode === 'border-image') {
    const fill = spec.fillCenter === false ? '' : ' fill';
    return {
      borderStyle: 'solid',
      borderWidth: spec.border,
      borderImageSource: `url("${spec.src}")`,
      borderImageSlice: `${spec.slice}${fill}`,
      borderImageWidth: `${spec.border}px`,
      borderImageRepeat: 'stretch',
    };
  }
  // mask-border: paint the tint, cut to the frame ring (no `fill` => hollow,
  // so the body layer shows through the centre).
  const maskValue = `url("${spec.src}") ${spec.slice} stretch`;
  return {
    background: spec.tint,
    borderStyle: 'solid',
    borderWidth: spec.border,
    borderColor: 'transparent',
    WebkitMaskBoxImage: maskValue,
    // Standard property (typed loosely; not in lib.dom yet across all targets).
    maskBorder: maskValue,
  } as CSSProperties;
}

export function Frame({
  spec,
  className,
  style,
  contentStyle,
  children,
}: {
  spec: FrameSpec;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={`lab-frame${className ? ` ${className}` : ''}`} style={{ position: 'relative', ...style }}>
      {spec.body && (
        <div
          aria-hidden
          className={`lab-frame-body${spec.body.bevel ? ' is-bevel' : ''}`}
          style={{
            position: 'absolute',
            inset: 0,
            background: spec.body.fill,
            borderRadius: spec.body.radius,
          }}
        />
      )}
      <div aria-hidden className="lab-frame-edge" style={{ position: 'absolute', inset: 0, ...edgeStyle(spec) }} />
      <div
        className="lab-frame-content"
        style={{ position: 'relative', padding: spec.border, ...contentStyle }}
      >
        {children}
      </div>
    </div>
  );
}
