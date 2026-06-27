Tales of Tileria — Rendering Constants

This is the single source of truth for the game's art look. Every preset embeds
it verbatim, so all generated sprites — item icons, world entities, effects —
share one consistent style. Per-sprite composition (framing, grounding) is added
by each preset on top of these constants; do not restate composition here.

Rendering style (identical for every sprite):
- Hand-painted, semi-stylized fantasy RPG look. Warm, slightly storybook palette
  with soft, rich shading. NOT flat vector art, NOT photoreal, NOT pixel art, NOT
  cel-shaded anime, NOT 3D render.
- Consistent lighting: soft key light from the upper-left, gentle warm rim light,
  and soft ambient occlusion in the crevices. Never a hard cast shadow.
- Consistent finish: a thin, soft darkened edge that reads as a faint outline so
  the subject pops on any background. Avoid thick black cartoon outlines.
- Painterly but clean: readable forms, no motion blur, no lens effects, no busy
  particle noise (unless the subject itself is an effect).
- Slight three-quarter viewing angle consistent with a top-down-ish game world,
  unless the preset says otherwise.

Output rules (identical for every sprite):
- Exactly one subject, fully in frame, never cropped at the edges.
- Plain, flat, neutral background: a single mid-gray fill. No scenery, no gradient,
  no vignette, no props, no surface, no table, no horizon.
- Absolutely no text, labels, watermark, logo, border, frame, or UI.
- No drop shadow or contact shadow painted onto the background.
