import { ASSET_URL } from '../assets/manifest';
import { skillIconTextureId, skillLabel } from './skillPresentation';

export function SkillIcon({
  skillId,
  size = 28,
  className = '',
  title,
}: {
  skillId: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const label = skillLabel(skillId);
  const textureId = skillIconTextureId(skillId);
  const texture = textureId ? ASSET_URL[textureId] : undefined;
  const radius = Math.max(6, Math.round(size * 0.18));
  const classNames = ['skill-icon', className].filter(Boolean).join(' ');

  if (texture) {
    return (
      <span className={classNames} style={{ width: size, height: size, borderRadius: radius }} title={title ?? label}>
        <img src={texture} alt={label} />
      </span>
    );
  }

  return (
    <span
      className={`${classNames} skill-icon-placeholder`}
      style={{ width: size, height: size, borderRadius: radius }}
      title={title ?? label}
      aria-label={label}
    >
      <span style={{ fontSize: Math.round(size * 0.34) }}>{label.charAt(0).toUpperCase()}</span>
    </span>
  );
}
