/**
 * UI LAB primitive — the reusable "something is new / actionable here" red dot.
 *
 * Renders a small dot, or a numbered badge when `count` is a number > 1. The
 * caller owns positioning: by default the dot pins to the top-right corner of
 * the nearest positioned ancestor, so wrap the host in `position: relative`.
 * Pass `inline` to render it in normal flow (e.g. beside a label) instead.
 *
 * This is the single source of truth for the red-dot look so every surface
 * (tab strip, skill rows, region rows, bag slots) reads identically. When the
 * lab is promoted it can move out of `ui/lab/` unchanged and be driven by real
 * store selectors instead of the mock notification model.
 */
export function NotificationDot({
  count,
  inline = false,
  title,
}: {
  /** When > 1, renders as a numbered badge; otherwise a plain dot. */
  count?: number;
  /** Render in normal flow instead of pinned to a corner. */
  inline?: boolean;
  title?: string;
}) {
  const showCount = typeof count === 'number' && count > 1;
  const label = title ?? (showCount ? `${count} new` : 'New');
  return (
    <span
      className={`lab-dot${inline ? ' is-inline' : ''}${showCount ? ' has-count' : ''}`}
      role="status"
      aria-label={label}
      title={label}
    >
      {showCount ? (count > 99 ? '99+' : count) : null}
    </span>
  );
}
