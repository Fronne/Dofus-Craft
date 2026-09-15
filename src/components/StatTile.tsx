import type { IconName } from './Icon';
import { Icon } from './Icon';

export function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="stat-tile-body">
        <span className="stat-tile-label">{label}</span>
        <span className="stat-tile-value">{value}</span>
        {hint && <span className="stat-tile-hint">{hint}</span>}
      </span>
    </div>
  );
}
