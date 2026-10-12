import type { ReactNode } from 'react';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function EmptyState({
  icon = 'search',
  title,
  description,
  children,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  // What the player can do next (a button or a link), shown under the text.
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {children && <div className="empty-state-actions">{children}</div>}
    </div>
  );
}
